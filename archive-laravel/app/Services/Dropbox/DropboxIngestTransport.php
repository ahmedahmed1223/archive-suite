<?php

declare(strict_types=1);

namespace App\Services\Dropbox;

use App\Models\User;
use App\Services\Ingest\IngestTransport;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * V1-762: pulls files from the user's connected Dropbox folder into the local
 * ingest disk, same contract as FtpIngestTransport/SmbIngestTransport. Large
 * files download in bounded-size Range requests (config ingest.chunk_upload.
 * max_chunk_bytes, reused from the upload-side chunking rather than inventing
 * a second knob) with progress persisted per (connection, path) in
 * dropbox_download_progress, so a crash mid-file resumes from the last
 * successfully written byte instead of restarting or silently skipping it --
 * the sync cursor alone can't answer that, since it already advances past a
 * file's listing entry once seen, independent of whether its bytes finished.
 */
class DropboxIngestTransport implements IngestTransport
{
    public function __construct(
        private readonly DropboxConnectionService $connections,
        private readonly DropboxGateway $gateway,
    ) {}

    /**
     * @param  array<string, mixed>  $params  Only 'user' is required: the
     *                                        already-authenticated User whose Dropbox connection and folder_path
     *                                        to pull from. Unlike FTP/SMB there is no host/user/password to pass
     *                                        per call -- OAuth tokens are already stored against the connection.
     * @return array<int, string> Local ingest-disk keys, one per file pulled
     *                            or already fully downloaded from an earlier interrupted attempt.
     */
    public function pull(array $params): array
    {
        $user = $params['user'] ?? null;
        if (! $user instanceof User) {
            throw new \RuntimeException('Dropbox pull requires a user parameter.');
        }

        $connection = $this->connections->connection($user);
        if (! $connection || $connection->status !== 'connected') {
            throw new \RuntimeException('Dropbox is not connected.');
        }

        $token = $this->connections->accessToken($connection);
        $cursor = DB::table('dropbox_sync_cursors')->where('connection_id', $connection->id)->value('cursor');
        $listing = $this->gateway->listFolder($token, $connection->folder_path, $cursor);
        DB::table('dropbox_sync_cursors')->updateOrInsert(
            ['connection_id' => $connection->id],
            ['cursor' => $listing['cursor'] ?? $cursor, 'updated_at' => now(), 'created_at' => now()],
        );

        $files = array_values(array_filter($listing['entries'] ?? [], fn (array $entry): bool => ($entry['.tag'] ?? '') === 'file'));

        $disk = Storage::disk(config('ingest.disk'));
        $ingestDir = trim((string) config('ingest.directory'), '/');
        $chunkBytes = max(1, (int) config('ingest.chunk_upload.max_chunk_bytes', 50 * 1024 * 1024));

        $keys = [];
        foreach ($files as $entry) {
            $path = $entry['path_display'] ?? $entry['path_lower'] ?? null;
            if (! is_string($path) || $path === '') {
                continue;
            }
            $keys[] = $this->downloadResumable($disk, $ingestDir, $connection, $token, $path, (int) ($entry['size'] ?? 0), $chunkBytes);
        }

        return $keys;
    }

    private function downloadResumable(
        Filesystem $disk,
        string $ingestDir,
        object $connection,
        string $token,
        string $path,
        int $totalSize,
        int $chunkBytes,
    ): string {
        $progress = DB::table('dropbox_download_progress')
            ->where('connection_id', $connection->id)->where('dropbox_path', $path)->first();

        if ($progress && $progress->status === 'complete') {
            return $progress->local_key;
        }

        $localKey = $progress->local_key ?? $ingestDir.'/'.ltrim(basename($path), '/');
        $chunkDir = $ingestDir.'/dropbox-downloads/'.$connection->id.'/'.sha1($path);
        $bytesDownloaded = $progress ? (int) $progress->bytes_downloaded : 0;

        if (! $progress) {
            DB::table('dropbox_download_progress')->insert([
                'connection_id' => $connection->id, 'dropbox_path' => $path, 'local_key' => $localKey,
                'total_size' => $totalSize, 'bytes_downloaded' => 0, 'status' => 'downloading',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        while ($bytesDownloaded < $totalSize) {
            $length = min($chunkBytes, $totalSize - $bytesDownloaded);
            $index = intdiv($bytesDownloaded, $chunkBytes);
            $response = $this->gateway->downloadRange($token, $path, $bytesDownloaded, $length);
            // Disks are configured throw=false, so a failed write returns false
            // rather than raising. Advancing the offset past an unwritten chunk
            // would persist progress for bytes that never landed, and assembly
            // would later stitch a short file and mark it complete.
            if (! $disk->put($chunkDir.'/'.$index, $response->body())) {
                throw new \RuntimeException('Unable to write Dropbox download chunk to the ingest disk.');
            }

            $bytesDownloaded += $length;
            DB::table('dropbox_download_progress')
                ->where('connection_id', $connection->id)->where('dropbox_path', $path)
                ->update(['bytes_downloaded' => $bytesDownloaded, 'updated_at' => now()]);
        }

        $this->assembleAndFinish($disk, $chunkDir, $localKey, $connection, $path, $totalSize, $chunkBytes);

        return $localKey;
    }

    private function assembleAndFinish(
        Filesystem $disk,
        string $chunkDir,
        string $localKey,
        object $connection,
        string $path,
        int $totalSize,
        int $chunkBytes,
    ): void {
        $chunkCount = $totalSize > 0 ? (int) ceil($totalSize / $chunkBytes) : 0;
        $assembled = '';
        for ($index = 0; $index < $chunkCount; $index++) {
            // A missing chunk reads back as null here, which would append nothing
            // and silently shorten the assembled file.
            $chunk = $disk->get($chunkDir.'/'.$index);
            if ($chunk === null) {
                throw new \RuntimeException('Dropbox download chunk is missing; refusing to assemble a truncated file.');
            }
            $assembled .= $chunk;
        }
        if (strlen($assembled) !== $totalSize) {
            throw new \RuntimeException('Assembled Dropbox download does not match the expected size.');
        }
        if (! $disk->put($localKey, $assembled)) {
            throw new \RuntimeException('Unable to write the assembled Dropbox download to the ingest disk.');
        }
        $disk->deleteDirectory($chunkDir);

        DB::table('dropbox_download_progress')
            ->where('connection_id', $connection->id)->where('dropbox_path', $path)
            ->update(['status' => 'complete', 'updated_at' => now()]);
    }
}
