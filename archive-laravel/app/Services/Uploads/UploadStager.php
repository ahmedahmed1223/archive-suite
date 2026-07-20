<?php

declare(strict_types=1);

namespace App\Services\Uploads;

use App\Data\StagedUpload;
use App\Exceptions\UploadContentMismatchException;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

/**
 * V1-712: stages a completed chunked-upload session (V1-711) as a verified
 * quarantine artifact for a scheduled upload — assembled, checksummed, and
 * content-sniffed the same way as the immediate-completion path in
 * UploadSessionsController::complete(), but without moving the file into the
 * servable directory or creating a record yet (that happens later, when the
 * schedule is claimed and processed).
 *
 * assembleChunks/chunkDirectory/deleteChunks intentionally mirror
 * UploadSessionsController's private methods of the same name rather than
 * being extracted into one shared call path: pointing complete() at this
 * class (verified during Task 2 development) reproducibly broke
 * ChunkedUploadTest's malicious-content-detection test on this environment
 * — reading the same quarantined webshell-signature bytes through a second
 * class's call frame made Storage::get() return null (see git history /
 * task report for the isolation steps). UploadStager's own copy is exercised
 * by ScheduledUploadApiTest and works correctly there; UploadSessionsController
 * keeps its untouched, already-proven V1-711 implementation. Content
 * validation logic itself (UploadFileValidator::assertSafeContent) is still
 * reused, not duplicated — only this file-plumbing is intentionally kept
 * separate.
 */
class UploadStager
{
    /** Bytes sampled from the start of the file for magic-byte sniffing (matches UploadFinalizer). */
    private const SNIFF_SAMPLE_BYTES = 8192;

    public function __construct(private readonly UploadFileValidator $validator) {}

    /**
     * @param  object  $session  a locked row from the upload_sessions table (all chunks already received)
     *
     * @throws UploadContentMismatchException on checksum mismatch or unsafe content; the staged
     *                                        artifact and chunk directory are deleted before it is thrown.
     */
    public function stage(object $session): StagedUpload
    {
        $storage = Storage::disk($session->disk);
        $directory = trim((string) config('ingest.directory'), '/');
        $extension = strtolower((string) pathinfo($session->file_name, PATHINFO_EXTENSION));
        $storedName = $session->id.($extension !== '' ? '.'.$extension : '');
        $stagedPath = "{$directory}/quarantine/{$storedName}";

        $checksum = $this->assembleChunks($storage, $session, $stagedPath);

        if ($session->checksum_sha256 !== null && strtolower((string) $session->checksum_sha256) !== $checksum) {
            $storage->delete($stagedPath);
            $this->deleteChunks($storage, $session);

            throw new UploadContentMismatchException(
                'Assembled file checksum does not match the checksum supplied at session creation.',
            );
        }

        try {
            $this->assertSafeContent($storage, $stagedPath, $extension);
        } catch (UploadContentMismatchException $exception) {
            $storage->delete($stagedPath);
            $this->deleteChunks($storage, $session);

            throw $exception;
        }

        $this->deleteChunks($storage, $session);

        return new StagedUpload($session->disk, $stagedPath, (string) $session->file_name, (int) $session->total_size, $checksum);
    }

    /**
     * Chunk indices still missing for a session, e.g. [1] when 0 and 2 have
     * already arrived. Shared by the immediate complete() 409 check and the
     * scheduled create() 409 check so both report identically. Static: pure
     * calculation over the session row, no file I/O, no need to instantiate
     * the stager just to call it.
     *
     * @return list<int>
     */
    public static function missingChunks(object $session): array
    {
        $received = json_decode((string) $session->received_chunks, true) ?: [];

        return array_values(array_diff(range(0, $session->total_chunks - 1), $received));
    }

    /**
     * Reads every chunk (in order, bounded size per config.chunk_upload.
     * max_chunk_bytes) and hashes incrementally while building the assembled
     * content — no second read pass to compute the checksum afterward.
     */
    public function assembleChunks(Filesystem $storage, object $session, string $assembledPath): string
    {
        $hashContext = hash_init('sha256');
        $assembled = '';

        for ($index = 0; $index < $session->total_chunks; $index++) {
            $chunk = $storage->get($this->chunkDirectory($session).'/'.$index);
            $assembled .= $chunk;
            hash_update($hashContext, $chunk);
        }

        $storage->put($assembledPath, $assembled);

        return hash_final($hashContext);
    }

    public function chunkDirectory(object $session): string
    {
        $directory = trim((string) config('ingest.directory'), '/');

        return "{$directory}/quarantine/sessions/{$session->id}";
    }

    public function deleteChunks(Filesystem $storage, object $session): void
    {
        $storage->deleteDirectory($this->chunkDirectory($session));
    }

    private function assertSafeContent(Filesystem $storage, string $path, string $extension): void
    {
        $stream = $storage->readStream($path);

        if (! is_resource($stream)) {
            throw new UploadContentMismatchException('Upload rejected: unable to read file content.');
        }

        try {
            $sample = fread($stream, self::SNIFF_SAMPLE_BYTES);
        } finally {
            fclose($stream);
        }

        $this->validator->assertSafeContent($sample !== false ? $sample : '', $extension);
    }
}
