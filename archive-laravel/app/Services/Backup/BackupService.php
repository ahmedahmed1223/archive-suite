<?php

declare(strict_types=1);

namespace App\Services\Backup;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use JsonException;
use stdClass;

/**
 * Synchronous JSON backup/restore for the storage_rows table, grouped by
 * store. Ported from the legacy Node backup scheduler (list/run/preview/
 * restore); encryption, checksums, and retention were deliberately left
 * behind — add them if backups start leaving the host.
 */
class BackupService
{
    // Strict allow-list of names run() itself produces; blocks path traversal.
    private const NAME_PATTERN = '/^backup-[A-Za-z0-9._-]+\.json\.gz$/';

    private const INSERT_CHUNK_SIZE = 500;

    /**
     * @return list<array{name: string, sizeBytes: int, createdAt: string, checksum: string|null}>
     */
    public function list(): array
    {
        $files = glob($this->directory().DIRECTORY_SEPARATOR.'backup-*.json.gz') ?: [];

        $backups = array_map(function (string $path): array {
            $name = basename($path);
            $checksumPath = $path.'.sha256';
            $checksum = null;

            if (is_file($checksumPath)) {
                $checksum = (string) file_get_contents($checksumPath);
            }

            return [
                'name' => $name,
                'sizeBytes' => (int) filesize($path),
                'createdAt' => date(DATE_ATOM, (int) filemtime($path)),
                'checksum' => $checksum,
            ];
        }, $files);

        // Names embed a sortable timestamp, so name order is creation order.
        usort($backups, static fn (array $a, array $b): int => strcmp($b['name'], $a['name']));

        return $backups;
    }

    /**
     * @return array{name: string, sizeBytes: int, stores: array<string, int>, completedAt: string, checksum: string}
     */
    public function run(): array
    {
        $snapshot = [];

        foreach (DB::table('storage_rows')->orderBy('store')->orderBy('uid')->get() as $row) {
            $snapshot[$row->store][] = [
                'uid' => $row->uid,
                'data' => json_decode((string) $row->data, true),
                'syncVersion' => $row->sync_version,
                'lastModifiedBy' => $row->last_modified_by !== null
                    ? json_decode((string) $row->last_modified_by, true)
                    : null,
            ];
        }

        // Microsecond stamp keeps names unique without a counter file.
        $name = 'backup-'.now()->format('Y-m-d\TH-i-s-u').'.json.gz';
        $path = $this->directory().DIRECTORY_SEPARATOR.$name;

        try {
            $encoded = gzencode(json_encode($snapshot === [] ? new stdClass : $snapshot, JSON_THROW_ON_ERROR), 9);
        } catch (JsonException $e) {
            throw new BackupException('Failed to serialize backup snapshot: '.$e->getMessage(), 500);
        }

        if ($encoded === false) {
            throw new BackupException('Failed to compress backup.', 500);
        }

        // Optional encryption: wrap gzipped content
        if ((bool) config('archive.backups.encryption_enabled')) {
            $encoded = $this->encrypt($encoded);
        }

        if (file_put_contents($path, $encoded) === false) {
            throw new BackupException('Failed to write backup file.', 500);
        }

        // Compute and store checksum
        $checksum = hash('sha256', $encoded);
        file_put_contents($path.'.sha256', $checksum);

        return [
            'name' => $name,
            'sizeBytes' => (int) filesize($path),
            'stores' => array_map('count', $snapshot),
            'completedAt' => now()->toIso8601String(),
            'checksum' => $checksum,
        ];
    }

    /**
     * @return array{name: string, stores: array<string, int>, totalRecords: int}
     */
    public function preview(string $name): array
    {
        $stores = array_map('count', $this->readSnapshot($name));

        return [
            'name' => $name,
            'stores' => $stores,
            'totalRecords' => array_sum($stores),
        ];
    }

    /**
     * @return array{name: string, counts: array<string, int>, restoredAt: string, verified: bool}
     */
    public function restore(string $name): array
    {
        $path = $this->resolvePath($name);

        // Integrity gate, BEFORE any data is touched. Reuses verify()'s checksum
        // logic rather than duplicating it. Older backups predate the .sha256
        // sidecar (V1-122 added it after the fact) — hard-failing every one of
        // those would brick historical restores, so absence of a sidecar falls
        // back to the structural validation readSnapshot() already performs and
        // the result is flagged unverified. A sidecar that IS present but does
        // not match means the file was corrupted or tampered with after backup;
        // that always aborts, since it's the exact class of silent-overwrite bug
        // this ticket exists to close.
        $hasChecksum = is_file($path.'.sha256');
        $verification = $this->verify($name);

        if ($hasChecksum && ! $verification['verified']) {
            throw new BackupException(
                'Backup integrity check failed ('.$verification['message'].'). Restore aborted; live data was not touched.',
                422
            );
        }

        if (! $hasChecksum) {
            logger()->warning('Restoring backup with no checksum sidecar; integrity unverified.', ['name' => $name]);
        }

        $snapshot = $this->readSnapshot($name);
        $counts = [];

        try {
            // ponytail: non-destructive via a single DB transaction rather than a
            // separate pre-restore snapshot file — every driver this app runs on
            // (sqlite, MySQL/InnoDB, Postgres) is transactional, so any failure
            // partway through (bad row, constraint violation) rolls back every
            // store's delete+insert together and live data ends up untouched.
            // Upgrade to an explicit pre-restore dump only if a future storage
            // backend can't guarantee transactional DDL here.
            DB::transaction(function () use ($snapshot, &$counts): void {
                $now = now();

                foreach ($snapshot as $store => $rows) {
                    DB::table('storage_rows')->where('store', $store)->delete();

                    $inserts = [];

                    foreach ($rows as $row) {
                        $uid = (string) ($row['uid'] ?? '');

                        if ($uid === '') {
                            continue;
                        }

                        $inserts[] = [
                            'store' => $store,
                            'uid' => $uid,
                            'data' => json_encode($row['data'] ?? [], JSON_THROW_ON_ERROR),
                            'sync_version' => $row['syncVersion'] ?? null,
                            'last_modified_by' => json_encode($row['lastModifiedBy'] ?? null, JSON_THROW_ON_ERROR),
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }

                    foreach (array_chunk($inserts, self::INSERT_CHUNK_SIZE) as $chunk) {
                        DB::table('storage_rows')->insert($chunk);
                    }

                    $counts[$store] = count($inserts);
                }
            });
        } catch (\Throwable $e) {
            throw new BackupException('Restore failed and was rolled back; live data was not touched: '.$e->getMessage(), 500);
        }

        return [
            'name' => $name,
            'counts' => $counts,
            'restoredAt' => now()->toIso8601String(),
            'verified' => $verification['verified'],
        ];
    }

    /**
     * Verify the integrity of a backup file via its SHA-256 checksum.
     *
     * @return array{name: string, checksum: string, verified: bool, message: string}
     */
    public function verify(string $name): array
    {
        $path = $this->resolvePath($name);
        $checksumPath = $path.'.sha256';

        // Read stored checksum
        if (! is_file($checksumPath)) {
            return [
                'name' => $name,
                'checksum' => '',
                'verified' => false,
                'message' => 'No checksum file found for this backup.',
            ];
        }

        $storedChecksum = trim((string) file_get_contents($checksumPath));

        // Compute current checksum
        $content = (string) file_get_contents($path);
        $computedChecksum = hash('sha256', $content);

        $verified = hash_equals($storedChecksum, $computedChecksum);

        return [
            'name' => $name,
            'checksum' => $storedChecksum,
            'verified' => $verified,
            'message' => $verified ? 'Checksum verified.' : 'Checksum mismatch — file may be corrupt.',
        ];
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private function readSnapshot(string $name): array
    {
        $path = $this->resolvePath($name);
        $content = (string) file_get_contents($path);

        // Optional decryption: reverse encryption applied during backup
        if ((bool) config('archive.backups.encryption_enabled')) {
            $content = $this->decrypt($content);
        }

        $decoded = @gzdecode($content);

        if ($decoded === false) {
            throw new BackupException('Backup file is corrupt or unreadable.', 422);
        }

        try {
            $snapshot = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new BackupException('Backup file does not contain valid JSON.', 422);
        }

        if (! is_array($snapshot)) {
            throw new BackupException('Backup file does not contain a valid snapshot.', 422);
        }

        $stores = [];

        foreach ($snapshot as $store => $rows) {
            if (! is_string($store) || ! is_array($rows)) {
                throw new BackupException('Backup file does not contain a valid snapshot.', 422);
            }

            $stores[$store] = array_values(array_filter($rows, 'is_array'));
        }

        return $stores;
    }

    /**
     * Encrypt backup content using Laravel's encryption.
     */
    private function encrypt(string $content): string
    {
        return Crypt::encrypt($content, serialize: false);
    }

    /**
     * Decrypt backup content using Laravel's encryption.
     */
    private function decrypt(string $encrypted): string
    {
        try {
            return Crypt::decrypt($encrypted, serialize: false);
        } catch (\Exception $e) {
            throw new BackupException('Failed to decrypt backup: '.$e->getMessage(), 422);
        }
    }

    private function resolvePath(string $name): string
    {
        if (preg_match(self::NAME_PATTERN, $name) !== 1 || str_contains($name, '..')) {
            throw new BackupException('Invalid backup name.', 400);
        }

        $path = $this->directory().DIRECTORY_SEPARATOR.$name;

        if (! is_file($path)) {
            throw new BackupException('Backup not found.', 404);
        }

        return $path;
    }

    private function directory(): string
    {
        $dir = (string) config('archive.backup_path');

        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return $dir;
    }
}
