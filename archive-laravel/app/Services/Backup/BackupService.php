<?php

declare(strict_types=1);

namespace App\Services\Backup;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use JsonException;

/**
 * Synchronous JSON backup/restore covering the full application schema
 * (every table but framework plumbing — auto-discovered, not a hardcoded
 * list) plus local files under archive.file_root (media, thumbnails,
 * exports). V1-122 added checksums/verification for the whole archive;
 * V1-121 adds a manifest, full-table coverage, per-file checksums, and
 * dependency-ordered restore on top of that.
 */
class BackupService
{
    // Strict allow-list of names run() itself produces; blocks path traversal.
    private const NAME_PATTERN = '/^backup-[A-Za-z0-9._-]+\.json\.gz$/';

    private const INSERT_CHUNK_SIZE = 500;

    // Framework plumbing: rebuilt by migrations/queue workers, never
    // meaningful application data. Everything else the schema reports is
    // backed up automatically — adding a migration is enough, no edit here.
    private const EXCLUDED_TABLES = [
        'migrations',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'sessions',
        'password_reset_tokens',
    ];

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
        $tables = $this->dumpTables();
        $files = $this->dumpFiles();

        $manifest = [
            'createdAt' => now()->toIso8601String(),
            'appVersion' => app()->version(),
            'dbDriver' => DB::connection()->getDriverName(),
            'tables' => array_map('count', $tables),
            'files' => array_map(static fn (array $f): array => [
                'path' => $f['path'],
                'sha256' => $f['sha256'],
                'sizeBytes' => $f['sizeBytes'],
            ], $files),
            'totalSizeBytes' => array_sum(array_column($files, 'sizeBytes')),
        ];

        $payload = [
            'manifest' => $manifest,
            'tables' => $tables,
            'files' => $files,
        ];

        // Microsecond stamp keeps names unique without a counter file.
        $name = 'backup-'.now()->format('Y-m-d\TH-i-s-u').'.json.gz';
        $path = $this->directory().DIRECTORY_SEPARATOR.$name;

        try {
            $encoded = gzencode(json_encode($payload, JSON_THROW_ON_ERROR), 9);
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
            'stores' => $this->storesFromStorageRows($tables['storage_rows'] ?? []),
            'completedAt' => now()->toIso8601String(),
            'checksum' => $checksum,
        ];
    }

    /**
     * @return array{name: string, stores: array<string, int>, totalRecords: int}
     */
    public function preview(string $name): array
    {
        $archive = $this->readArchive($name);
        $stores = $this->storesFromStorageRows($archive['tables']['storage_rows'] ?? []);

        return [
            'name' => $name,
            'stores' => $stores,
            'totalRecords' => array_sum($stores),
        ];
    }

    /**
     * @return array{name: string, counts: array<string, int>, tableCounts: array<string, int>, restoredAt: string, verified: bool}
     */
    public function restore(string $name): array
    {
        $path = $this->resolvePath($name);

        // Integrity gate, BEFORE any data is touched. Reuses verify()'s checksum
        // logic rather than duplicating it. Older backups predate the .sha256
        // sidecar (V1-122 added it after the fact) — hard-failing every one of
        // those would brick historical restores, so absence of a sidecar falls
        // back to the structural validation readArchive() already performs and
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

        $archive = $this->readArchive($name);

        // Manifest-driven per-file checksum gate, same "verify before applying"
        // shape as the whole-archive gate above — a corrupt or tampered file
        // entry inside an otherwise-valid archive must not silently overwrite
        // the file it maps to. Legacy archives carry no file entries, so this
        // is a no-op for them.
        foreach ($archive['files'] as $file) {
            $content = base64_decode((string) ($file['contentBase64'] ?? ''), true);
            $expected = (string) ($file['sha256'] ?? '');

            if ($content === false || $expected === '' || ! hash_equals($expected, hash('sha256', $content))) {
                throw new BackupException(
                    'Backup file entry "'.((string) ($file['path'] ?? '?')).'" failed checksum verification. Restore aborted; live data was not touched.',
                    422
                );
            }
        }

        // Dependency-ordered per table, driven by the schema's own foreign
        // keys (not a hardcoded table order) so parents restore before the
        // children that reference them, and deletes run in the opposite
        // direction. See orderByDependency().
        $insertOrder = $this->orderByDependency(array_keys($archive['tables']));
        $deleteOrder = array_reverse($insertOrder);

        try {
            // ponytail: non-destructive via a single DB transaction rather than a
            // separate pre-restore snapshot file — every driver this app runs on
            // (sqlite, MySQL/InnoDB, Postgres) is transactional, so any failure
            // partway through (bad row, constraint violation) rolls back every
            // table's delete+insert together and live data ends up untouched.
            DB::transaction(function () use ($archive, $insertOrder, $deleteOrder): void {
                foreach ($deleteOrder as $table) {
                    if (Schema::hasTable($table)) {
                        DB::table($table)->delete();
                    }
                }

                foreach ($insertOrder as $table) {
                    if (! Schema::hasTable($table)) {
                        // Table existed when the backup was taken and has since
                        // been dropped; skip it rather than fail the whole restore.
                        continue;
                    }

                    $inserts = array_values(array_filter($archive['tables'][$table], 'is_array'));

                    foreach (array_chunk($inserts, self::INSERT_CHUNK_SIZE) as $chunk) {
                        if ($chunk !== []) {
                            DB::table($table)->insert($chunk);
                        }
                    }
                }
            });
        } catch (\Throwable $e) {
            throw new BackupException('Restore failed and was rolled back; live data was not touched: '.$e->getMessage(), 500);
        }

        // Filesystem writes aren't part of the DB transaction — the filesystem
        // isn't transactional — so they only run after the DB commit succeeds.
        // Checksums were already verified above, before the DB was touched.
        foreach ($archive['files'] as $file) {
            $this->writeRestoredFile($file);
        }

        return [
            'name' => $name,
            'counts' => $this->storesFromStorageRows($archive['tables']['storage_rows'] ?? []),
            'tableCounts' => array_map('count', $archive['tables']),
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
     * Full, schema-driven dump of every application table. Table list comes
     * from the schema itself (minus EXCLUDED_TABLES), so newly migrated
     * tables are picked up on the next backup with no code change here.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    private function dumpTables(): array
    {
        $tables = [];

        foreach (Schema::getTableListing(schemaQualified: false) as $table) {
            if (in_array($table, self::EXCLUDED_TABLES, true)) {
                continue;
            }

            $tables[$table] = array_map(
                static fn (object $row): array => (array) $row,
                DB::table($table)->get()->all()
            );
        }

        return $tables;
    }

    /**
     * Dump every file under archive.file_root (uploaded/derived media,
     * thumbnails, exports on the local disk) into the archive, content
     * included as base64 so restore can write it back without touching a
     * live disk mid-backup.
     *
     * ponytail: only the local file_root is covered. Files living on a
     * remote-only disk (S3/Azure/GCS/Dropbox/SFTP/FTP) never touch this
     * host's filesystem, so there's nothing here to hash or embed — that
     * needs the provider's own snapshot/versioning, not app-level backup.
     *
     * @return list<array{path: string, sha256: string, sizeBytes: int, contentBase64: string}>
     */
    private function dumpFiles(): array
    {
        $root = (string) config('archive.file_root');

        if (! is_dir($root)) {
            return [];
        }

        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            if (! $fileInfo->isFile()) {
                continue;
            }

            $realPath = $fileInfo->getPathname();
            $relative = ltrim(str_replace('\\', '/', substr($realPath, strlen($root))), '/');
            $content = (string) file_get_contents($realPath);

            $files[] = [
                'path' => $relative,
                'sha256' => hash('sha256', $content),
                'sizeBytes' => strlen($content),
                'contentBase64' => base64_encode($content),
            ];
        }

        // Deterministic order for a readable manifest and stable tests.
        usort($files, static fn (array $a, array $b): int => strcmp($a['path'], $b['path']));

        return $files;
    }

    /**
     * @param  list<array<string, mixed>>  $rows  raw storage_rows rows (store, uid, data, ...)
     * @return array<string, int>
     */
    private function storesFromStorageRows(array $rows): array
    {
        $counts = [];

        foreach ($rows as $row) {
            $store = (string) ($row['store'] ?? '');

            if ($store === '') {
                continue;
            }

            $counts[$store] = ($counts[$store] ?? 0) + 1;
        }

        return $counts;
    }

    /**
     * Topologically orders tables so a table referenced by a foreign key
     * comes before the table that references it (dependency-first, for
     * inserts; the caller reverses it for deletes). Driven by the schema's
     * own FK metadata via Schema::getForeignKeys() — not a hardcoded
     * dependency list — so it keeps working as tables and relationships
     * change.
     *
     * @param  list<string>  $tables
     * @return list<string>
     */
    private function orderByDependency(array $tables): array
    {
        $known = array_flip($tables);
        $dependsOn = [];

        foreach ($tables as $table) {
            $dependsOn[$table] = [];

            if (! Schema::hasTable($table)) {
                continue;
            }

            try {
                foreach (Schema::getForeignKeys($table) as $fk) {
                    $referenced = $fk['foreign_table'] ?? null;

                    if (is_string($referenced) && $referenced !== $table && isset($known[$referenced])) {
                        $dependsOn[$table][] = $referenced;
                    }
                }
            } catch (\Throwable) {
                // Driver couldn't report FKs for this table; treat as dependency-free.
            }
        }

        $ordered = [];
        $done = [];
        $visiting = [];

        $visit = function (string $table) use (&$visit, &$dependsOn, &$ordered, &$done, &$visiting): void {
            if (isset($done[$table]) || isset($visiting[$table])) {
                return; // already placed, or a cycle — best effort, don't loop forever.
            }

            $visiting[$table] = true;

            foreach ($dependsOn[$table] ?? [] as $dependency) {
                $visit($dependency);
            }

            unset($visiting[$table]);
            $done[$table] = true;
            $ordered[] = $table;
        };

        foreach ($tables as $table) {
            $visit($table);
        }

        return $ordered;
    }

    /**
     * @param  array{path?: mixed, contentBase64?: mixed}  $file
     */
    private function writeRestoredFile(array $file): void
    {
        $relative = (string) ($file['path'] ?? '');

        if ($relative === '' || str_contains($relative, '..')) {
            return; // defensive: never write outside file_root.
        }

        $root = (string) config('archive.file_root');
        $target = $root.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative);
        $dir = dirname($target);

        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        file_put_contents($target, base64_decode((string) ($file['contentBase64'] ?? ''), true));
    }

    /**
     * Reads and validates a backup archive, normalizing both the current
     * (V1-121) format and the pre-manifest legacy format into the same
     * {tables, files, manifest} shape so restore()/preview() only need one
     * code path.
     *
     * @return array{tables: array<string, list<array<string, mixed>>>, files: list<array<string, mixed>>, manifest: array<string, mixed>|null}
     */
    private function readArchive(string $name): array
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
            $payload = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new BackupException('Backup file does not contain valid JSON.', 422);
        }

        if (! is_array($payload)) {
            throw new BackupException('Backup file does not contain a valid snapshot.', 422);
        }

        if (isset($payload['manifest'], $payload['tables']) && is_array($payload['tables'])) {
            return $this->readV2Archive($payload);
        }

        return $this->readLegacyArchive($payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{tables: array<string, list<array<string, mixed>>>, files: list<array<string, mixed>>, manifest: array<string, mixed>|null}
     */
    private function readV2Archive(array $payload): array
    {
        $tables = [];

        foreach ($payload['tables'] as $table => $rows) {
            if (! is_string($table) || ! is_array($rows)) {
                throw new BackupException('Backup file does not contain a valid snapshot.', 422);
            }

            $tables[$table] = array_values(array_filter($rows, 'is_array'));
        }

        $files = is_array($payload['files'] ?? null)
            ? array_values(array_filter($payload['files'], 'is_array'))
            : [];

        return [
            'tables' => $tables,
            'files' => $files,
            'manifest' => is_array($payload['manifest']) ? $payload['manifest'] : null,
        ];
    }

    /**
     * Pre-V1-121 format: a flat map of store => rows, covering only
     * storage_rows. Reshaped into the same {tables, files} structure the
     * restore path uses, so one restore implementation serves both.
     *
     * @param  array<string, mixed>  $payload
     * @return array{tables: array{storage_rows: list<array<string, mixed>>}, files: list<empty>, manifest: null}
     */
    private function readLegacyArchive(array $payload): array
    {
        $now = now();
        $rows = [];

        foreach ($payload as $store => $storeRows) {
            if (! is_string($store) || ! is_array($storeRows)) {
                throw new BackupException('Backup file does not contain a valid snapshot.', 422);
            }

            foreach ($storeRows as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $uid = (string) ($row['uid'] ?? '');

                if ($uid === '') {
                    continue;
                }

                $rows[] = [
                    'store' => $store,
                    'uid' => $uid,
                    'data' => json_encode($row['data'] ?? [], JSON_THROW_ON_ERROR),
                    'sync_version' => $row['syncVersion'] ?? null,
                    'last_modified_by' => json_encode($row['lastModifiedBy'] ?? null, JSON_THROW_ON_ERROR),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        return [
            'tables' => ['storage_rows' => $rows],
            'files' => [],
            'manifest' => null,
        ];
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
