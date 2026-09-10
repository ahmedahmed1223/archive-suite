<?php

namespace App\Services\Ingest;

use App\Jobs\ProcessMediaWorkflow;
use App\Support\RequestCorrelation;
use App\Services\Media\IngestDerivativeService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class IngestScanner
{
    /** @var list<string> */
    private const QC_MEDIA_EXTENSIONS = [
        'mp4', 'mov', 'mxf', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'ts', 'm2ts', 'mts', 'dv',
        'wav', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac',
    ];

    public function __construct(
        private readonly string $disk,
        private readonly string $directory,
        private readonly IngestDerivativeService $ingestDerivatives,
    ) {}

    /**
     * Scan ingest directory and create records for new files.
     *
     * @return array{ingested: array<int, array<string, string>>, skipped: int}
     */
    public function scan(?string $subdir = null): array
    {
        return $this->scanDirectory($subdir, false);
    }

    public function scanWatched(): array
    {
        return $this->scanDirectory(null, true);
    }

    private function scanDirectory(?string $subdir, bool $requireStable): array
    {
        $storage = Storage::disk($this->disk);
        $scanPath = $subdir ? "{$this->directory}/{$subdir}" : $this->directory;

        if (! $storage->exists($scanPath)) {
            return ['ingested' => [], 'skipped' => 0];
        }

        $files = $storage->files($scanPath);
        $ingested = [];
        $skipped = 0;

        foreach ($files as $filePath) {
            try {
                if ($requireStable && ! $this->isStable($storage, $filePath)) {
                    $skipped++;

                    continue;
                }
                $checksum = $this->computeChecksum($filePath);

                // Check if already ingested by checksum
                $existing = DB::table('storage_rows')
                    ->where('store', 'archive-items')
                    ->whereJsonContains('data->checksum', $checksum)
                    ->first();

                if ($existing) {
                    $skipped++;

                    continue;
                }

                // Create storage_rows record
                $fileName = basename($filePath);
                $recordId = (string) Str::uuid();
                $now = now();

                $recordData = [
                    'id' => $recordId,
                    'uid' => $recordId,
                    'title' => $fileName,
                    'fileName' => $fileName,
                    'filePath' => $filePath,
                    'checksum' => $checksum,
                    'source' => 'ingest',
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

                // Enqueue media job if media extension
                if ($this->isMediaFile($fileName)) {
                    $this->enqueueMediaJobs($recordId, $filePath);
                    $this->ingestDerivatives->queueBaseline($recordId, $filePath, $fileName);
                }

                $ingested[] = [
                    'id' => $recordId,
                    'fileName' => $fileName,
                    'checksum' => $checksum,
                ];
            } catch (Throwable) {
                // Skip files that fail checksum computation
                $skipped++;
            }
        }

        return ['ingested' => $ingested, 'skipped' => $skipped];
    }

    private function isStable($storage, string $filePath): bool
    {
        return $storage->lastModified($filePath) <= now()->subSeconds((int) config('ingest.watched.min_stable_seconds', 30))->timestamp;
    }

    private function computeChecksum(string $filePath): string
    {
        $storage = Storage::disk($this->disk);
        $stream = $storage->readStream($filePath);
        $hash = hash_init('sha256');

        while (! feof($stream)) {
            $chunk = fread($stream, 8192);
            if ($chunk === false) {
                break;
            }
            hash_update($hash, $chunk);
        }
        fclose($stream);

        return hash_final($hash);
    }

    private function isMediaFile(string $fileName): bool
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $mediaExtensions = config('ingest.media_extensions', []);

        return in_array($extension, $mediaExtensions, true);
    }

    private function enqueueMediaJobs(string $recordId, string $filePath): void
    {
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $operations = ['thumbnail', 'media_probe'];
        if (in_array($extension, self::QC_MEDIA_EXTENSIONS, true)) {
            $operations[] = 'media_qc';
        }

        foreach ($operations as $operation) {
            $jobId = (string) Str::uuid();
            $now = now();

            DB::table('media_jobs')->insert([
                'id' => $jobId,
                'record_id' => $recordId,
                'operation' => $operation,
                'status' => 'queued',
                'source_path' => $filePath,
                'options' => json_encode([], JSON_THROW_ON_ERROR),
                'queued_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            ProcessMediaWorkflow::dispatch($jobId, RequestCorrelation::id());
        }
    }
}
