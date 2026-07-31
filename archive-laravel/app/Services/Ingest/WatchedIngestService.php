<?php

namespace App\Services\Ingest;

use App\Services\Uploads\UploadFinalizer;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class WatchedIngestService
{
    public function __construct(private readonly UploadFinalizer $finalizer) {}

    public function preview(): array
    {
        $disk = (string) config('ingest.disk');
        $directory = trim((string) config('ingest.directory'), '/').'/watched';
        $id = (string) Str::uuid(); $now = now();
        DB::table('watched_ingest_batches')->insert(['id' => $id, 'status' => 'pending', 'disk' => $disk, 'directory' => $directory, 'created_at' => $now, 'updated_at' => $now]);
        $storage = Storage::disk($disk); $entries = [];
        foreach ($storage->files($directory) as $path) {
            $entryId = (string) Str::uuid(); $status = 'pending'; $reason = null; $checksum = null;
            try {
                if ($storage->lastModified($path) > now()->subSeconds((int) config('ingest.watched.min_stable_seconds', 30))->timestamp) { $status = 'deferred'; $reason = 'file_not_stable'; }
                else { $checksum = $this->checksum($storage, $path); if (DB::table('storage_rows')->where('store', 'archive-items')->whereJsonContains('data->checksum', $checksum)->exists()) { $status = 'quarantined'; $reason = 'duplicate_checksum'; } }
            } catch (Throwable) { $status = 'quarantined'; $reason = 'unreadable_file'; }
            try { $size = (int) $storage->size($path); } catch (Throwable) { $size = 0; $status = 'quarantined'; $reason = 'unreadable_file'; }
            if ($status === 'quarantined' && ! $storage->move($path, $this->quarantinePath($entryId, basename($path)))) $reason = 'isolation_failed';
            $entry = ['id' => $entryId, 'batch_id' => $id, 'source_path' => $path, 'file_name' => basename($path), 'size' => $size, 'checksum' => $checksum, 'status' => $status, 'reason' => $reason, 'created_at' => $now, 'updated_at' => $now];
            DB::table('watched_ingest_entries')->insert($entry); $entries[] = $this->entrySummary($entry);
        }
        return ['id' => $id, 'status' => 'pending', 'entries' => $entries];
    }

    public function apply(string $batchId): ?array
    {
        $batch = DB::table('watched_ingest_batches')->where('id', $batchId)->first();
        if ($batch === null) return null;

        $storage = Storage::disk($batch->disk);
        foreach (DB::table('watched_ingest_entries')->where('batch_id', $batchId)->where('status', 'pending')->get() as $entry) {
            try {
                $extension = pathinfo($entry->file_name, PATHINFO_EXTENSION);
                $quarantinePath = $this->quarantinePath($entry->id, $entry->file_name);
                if (! $storage->move($entry->source_path, $quarantinePath)) throw new \RuntimeException('Could not isolate watched file.');
                $this->finalizer->finalize($batch->disk, $quarantinePath, (string) Str::uuid().($extension === '' ? '' : '.'.$extension), $entry->file_name, $entry->checksum, 'ingest/watched/accepted');
                DB::table('watched_ingest_entries')->where('id', $entry->id)->update(['status' => 'applied', 'reason' => null, 'updated_at' => now()]);
            } catch (Throwable) {
                DB::table('watched_ingest_entries')->where('id', $entry->id)->update(['status' => 'quarantined', 'reason' => 'apply_failed', 'updated_at' => now()]);
            }
        }

        DB::table('watched_ingest_batches')->where('id', $batchId)->update(['status' => 'completed', 'updated_at' => now()]);

        return ['id' => $batchId, 'status' => 'completed', 'entries' => DB::table('watched_ingest_entries')->where('batch_id', $batchId)->get()->map(fn ($entry) => $this->entrySummary((array) $entry))->all()];
    }

    private function checksum(Filesystem $storage, string $path): string
    {
        $stream = $storage->readStream($path);
        if (! is_resource($stream)) throw new \RuntimeException('Could not read watched file.');
        $hash = hash_init('sha256');
        try { while (! feof($stream)) { hash_update($hash, fread($stream, 8192) ?: ''); } } finally { fclose($stream); }
        return hash_final($hash);
    }

    /** @param array<string, mixed> $entry */
    private function entrySummary(array $entry): array
    {
        return ['id' => $entry['id'], 'fileName' => $entry['file_name'], 'status' => $entry['status'], 'reason' => $entry['reason'], 'checksum' => $entry['checksum']];
    }

    private function quarantinePath(string $entryId, string $fileName): string
    {
        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
        return 'ingest/quarantine/watched/'.$entryId.($extension === '' ? '' : '.'.$extension);
    }
}
