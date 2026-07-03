<?php

declare(strict_types=1);

namespace App\Services\Backup;

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
     * @return list<array{name: string, sizeBytes: int, createdAt: string}>
     */
    public function list(): array
    {
        $files = glob($this->directory().DIRECTORY_SEPARATOR.'backup-*.json.gz') ?: [];

        $backups = array_map(static fn (string $path): array => [
            'name' => basename($path),
            'sizeBytes' => (int) filesize($path),
            'createdAt' => date(DATE_ATOM, (int) filemtime($path)),
        ], $files);

        // Names embed a sortable timestamp, so name order is creation order.
        usort($backups, static fn (array $a, array $b): int => strcmp($b['name'], $a['name']));

        return $backups;
    }

    /**
     * @return array{name: string, sizeBytes: int, stores: array<string, int>, completedAt: string}
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

        if ($encoded === false || file_put_contents($path, $encoded) === false) {
            throw new BackupException('Failed to write backup file.', 500);
        }

        return [
            'name' => $name,
            'sizeBytes' => (int) filesize($path),
            'stores' => array_map('count', $snapshot),
            'completedAt' => now()->toIso8601String(),
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
     * @return array{name: string, counts: array<string, int>, restoredAt: string}
     */
    public function restore(string $name): array
    {
        $snapshot = $this->readSnapshot($name);
        $counts = [];

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

        return [
            'name' => $name,
            'counts' => $counts,
            'restoredAt' => now()->toIso8601String(),
        ];
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private function readSnapshot(string $name): array
    {
        $path = $this->resolvePath($name);

        $decoded = @gzdecode((string) file_get_contents($path));

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
