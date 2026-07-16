<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\UploadContentMismatchException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use App\Jobs\ProcessMediaWorkflow;
use App\Services\Uploads\UploadFileValidator;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadsController extends Controller
{
    /** Bytes sampled from the start of the file for magic-byte sniffing. */
    private const SNIFF_SAMPLE_BYTES = 8192;

    public function __construct(private readonly UploadFileValidator $validator) {}

    public function store(StoreUploadRequest $request): JsonResponse
    {
        $disk = (string) config('ingest.disk');
        $directory = trim((string) config('ingest.directory'), '/');
        $folder = trim((string) $request->validated('folder', ''), '/');
        $targetDir = $folder !== '' ? "{$directory}/uploads/{$folder}" : "{$directory}/uploads";
        $quarantineDir = "{$directory}/quarantine";

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $checksum = hash_file('sha256', $file->getRealPath());

        if ($denied = $this->assertCapacityAvailable($disk, (int) $file->getSize())) {
            return $denied;
        }

        // UUID-based storage name — never the client-supplied filename, so
        // path traversal / overwrite via crafted filenames is not possible.
        $storedName = (string) Str::uuid().($extension !== '' ? '.'.$extension : '');

        $storage = Storage::disk($disk);

        // Quarantine tier: land the upload in a non-public, non-served
        // directory first. It is moved into the servable uploads path only
        // after content validation passes; on failure it is deleted, not
        // just rejected with an HTTP error, so nothing invalid lingers on
        // disk (V1-112 — real AV/ClamAV scanning is deferred, see TASKS.md).
        $quarantinePath = $file->storeAs($quarantineDir, $storedName, ['disk' => $disk]);

        try {
            $this->assertSafeContent($storage, $quarantinePath, $extension);
        } catch (UploadContentMismatchException $exception) {
            $storage->delete($quarantinePath);

            return response()->json([
                'ok' => false,
                'error' => $exception->getMessage(),
                'code' => 'unsafe_file_content',
            ], 422);
        }

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

        return response()->json([
            'ok' => true,
            'record' => $recordData,
        ], 201);
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

    /**
     * Rejects an upload before it ever touches disk when it would leave
     * less than the configured safety margin of free space, or push usage
     * past the configured storage quota. Runs before the quarantine write,
     * so a rejection never leaves a file behind.
     */
    private function assertCapacityAvailable(string $disk, int $incomingBytes): ?JsonResponse
    {
        if (config("filesystems.disks.{$disk}.driver") !== 'local') {
            return null;
        }

        $root = Storage::disk($disk)->path('');
        $free = @disk_free_space($root);
        $total = @disk_total_space($root);

        if ($free === false || $total === false) {
            return null;
        }

        $minFreeBytes = (int) config('ingest.min_free_bytes', 100 * 1024 * 1024);
        if ($free - $incomingBytes < $minFreeBytes) {
            return response()->json([
                'ok' => false,
                'error' => 'Not enough free disk space to accept this upload.',
                'code' => 'insufficient_disk_space',
            ], 507);
        }

        $quotaBytes = config('ingest.storage_quota_bytes');
        if ($quotaBytes !== null && ($total - $free) + $incomingBytes > (int) $quotaBytes) {
            return response()->json([
                'ok' => false,
                'error' => 'Storage quota exceeded.',
                'code' => 'storage_quota_exceeded',
            ], 413);
        }

        return null;
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
