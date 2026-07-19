<?php

namespace App\Services\Uploads;

use App\Exceptions\UploadContentMismatchException;
use App\Jobs\ProcessMediaWorkflow;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Extracted from UploadsController::store() (V1-711) so single-shot and
 * chunked (assembled) uploads share one finalize path: content-sniff the
 * already-quarantined file, move it into the servable directory, and create
 * the archive record + optional thumbnail job. Both callers write the raw
 * bytes to quarantine themselves first — a single-shot multipart write, or a
 * streamed concatenation of chunks — since that part differs by caller.
 */
class UploadFinalizer
{
    /** Bytes sampled from the start of the file for magic-byte sniffing. */
    private const SNIFF_SAMPLE_BYTES = 8192;

    public function __construct(private readonly UploadFileValidator $validator) {}

    /**
     * @return array{recordId: string, record: array<string, mixed>}
     *
     * @throws UploadContentMismatchException Caller must delete $quarantinePath when this is thrown.
     */
    public function finalize(
        string $disk,
        string $quarantinePath,
        string $storedName,
        string $fileName,
        string $checksum,
        string $targetDir,
    ): array {
        $storage = Storage::disk($disk);
        $extension = strtolower((string) pathinfo($fileName, PATHINFO_EXTENSION));

        $this->assertSafeContent($storage, $quarantinePath, $extension);

        $storedPath = "{$targetDir}/{$storedName}";
        $storage->move($quarantinePath, $storedPath);

        $recordId = (string) Str::uuid();
        $now = now();

        $recordData = [
            'id' => $recordId,
            'uid' => $recordId,
            'title' => $fileName,
            'fileName' => $fileName,
            'filePath' => $storedPath,
            'checksum' => $checksum,
            'source' => 'upload',
            'createdAt' => $now->toIso8601String(),
            'updatedAt' => $now->toIso8601String(),
        ];

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $recordId,
            'data' => json_encode($recordData, JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($this->isThumbnailCandidate($fileName)) {
            $this->enqueueMediaJob($recordId, $storedPath);
        }

        return ['recordId' => $recordId, 'record' => $recordData];
    }

    /**
     * Reads a leading sample of the quarantined file's real bytes (works for
     * any disk driver, not just local) and runs it through magic-byte
     * validation. Throws on mismatch; caller is responsible for deleting the
     * quarantined file.
     */
    private function assertSafeContent(Filesystem $storage, string $quarantinePath, string $extension): void
    {
        $stream = $storage->readStream($quarantinePath);

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

    private function isThumbnailCandidate(string $fileName): bool
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $thumbnailExtensions = [
            'mp4', 'mov', 'mxf', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'ts', 'm2ts', 'mts', 'dv',
            'jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'webp',
        ];

        return in_array($extension, $thumbnailExtensions, true);
    }

    private function enqueueMediaJob(string $recordId, string $filePath): void
    {
        $jobId = (string) Str::uuid();
        $now = now();

        DB::table('media_jobs')->insert([
            'id' => $jobId,
            'record_id' => $recordId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'source_path' => $filePath,
            'options' => json_encode([], JSON_THROW_ON_ERROR),
            'queued_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        ProcessMediaWorkflow::dispatch($jobId);
    }
}
