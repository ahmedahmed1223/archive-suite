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

    /** Marker on line one of a line-delimited archive; absent in older formats. */
    private const NDJSON_FORMAT = 'ndjson-v1';

    // V2-204: 8-byte magic identifying the streamed-chunk AEAD encryption
    // format, checked before any gzip/ndjson sniffing so encrypted archives
    // are detected regardless of the current encryption_enabled setting.
    private const ENC_MAGIC = "ARCENCV1";

    // Plaintext bytes per AEAD chunk before encryption. Peak memory for
    // encrypt/decrypt is one chunk, not the whole archive.
    private const ENC_CHUNK_SIZE = 4 * 1024 * 1024;

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
        // Metadata only: hashes stream off disk, so this stays flat no matter
        // how large the archive is. File CONTENT is never held here.
        $fileMeta = $this->hashFiles();

        $manifest = [
            'createdAt' => now()->toIso8601String(),
            'appVersion' => app()->version(),
            'dbDriver' => DB::connection()->getDriverName(),
            'tables' => array_map('count', $tables),
            'files' => array_map(static fn (array $f): array => [
                'path' => $f['path'],
                'sha256' => $f['sha256'],
                'sizeBytes' => $f['sizeBytes'],
            ], $fileMeta),
            'totalSizeBytes' => array_sum(array_column($fileMeta, 'sizeBytes')),
        ];

        // Microsecond stamp keeps names unique without a counter file.
        $name = 'backup-'.now()->format('Y-m-d\TH-i-s-u').'.json.gz';
        $path = $this->directory().DIRECTORY_SEPARATOR.$name;

        // V2-204: both paths stream now. When encryption is enabled the ndjson
        // gzip stream writes to a private temp file first, then that file is
        // re-streamed through AEAD chunk encryption into $path -- peak memory
        // is one chunk either way, never the whole archive.
        $checksum = $this->writeStreamedArchive($path, $manifest, $tables, $fileMeta);

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

        // V2-204: encrypted archives are ndjson too once decrypted -- decrypt
        // once here to a temp plaintext file so both streamed passes below
        // get the same memory-flat guarantee as unencrypted archives, instead
        // of falling back to the fully-materialized $archive['files'] path.
        $decryptedStreamPath = null;
        $streamPath = $path;

        if ($this->isChunkedEncryptedArchive($path)) {
            $decryptedStreamPath = $this->streamDecryptToTemp($path);
            $streamPath = $decryptedStreamPath;
        }

        try {
            // Manifest-driven per-file checksum gate, same "verify before applying"
            // shape as the whole-archive gate above — a corrupt or tampered file
            // entry inside an otherwise-valid archive must not silently overwrite
            // the file it maps to. Legacy archives carry no file entries, so this
            // is a no-op for them.
            // Line-delimited archives are walked twice on purpose: once to verify
            // every entry before the database is touched, once to write. Holding all
            // content between the two passes would recreate the memory blow-up this
            // format exists to avoid, and verifying lazily during the write would
            // lose the "nothing is touched unless everything checks out" guarantee.
            $isStreamed = $this->isNdjsonArchive($streamPath);

            if ($isStreamed) {
                foreach ($this->streamNdjsonRecords($streamPath) as $record) {
                    if (($record['kind'] ?? null) === 'file') {
                        $this->assertFileEntryIntact($record);
                    }
                }
            } else {
                foreach ($archive['files'] as $file) {
                    $this->assertFileEntryIntact($file);
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
            if ($isStreamed) {
                foreach ($this->streamNdjsonRecords($streamPath) as $record) {
                    if (($record['kind'] ?? null) === 'file') {
                        $this->writeRestoredFile($record);
                    }
                }
            } else {
                foreach ($archive['files'] as $file) {
                    $this->writeRestoredFile($file);
                }
            }

            return [
                'name' => $name,
                'counts' => $this->storesFromStorageRows($archive['tables']['storage_rows'] ?? []),
                'tableCounts' => array_map('count', $archive['tables']),
                'restoredAt' => now()->toIso8601String(),
                'verified' => $verification['verified'],
            ];
        } finally {
            if ($decryptedStreamPath !== null) {
                @unlink($decryptedStreamPath);
            }
        }
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

        // hash_file streams the archive instead of loading it. Reading a
        // multi-gigabyte backup into a string here defeated the whole point of
        // writing it incrementally, and blew memory on the first archive large
        // enough to matter.
        $computedChecksum = hash_file('sha256', $path);

        if ($computedChecksum === false) {
            throw new BackupException('Failed to checksum backup file.', 500);
        }

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
    /**
     * Pass one: walk the file root collecting metadata only. hash_file reads
     * incrementally, so peak memory is one buffer regardless of file or archive
     * size -- unlike dumpFiles(), which materializes every file at once.
     *
     * @return list<array{path: string, realPath: string, sha256: string, sizeBytes: int}>
     */
    private function hashFiles(): array
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
            $hash = hash_file('sha256', $realPath);

            if ($hash === false) {
                throw new BackupException('Failed to hash backup source file.', 500);
            }

            $files[] = [
                'path' => ltrim(str_replace('\\', '/', substr($realPath, strlen($root))), '/'),
                'realPath' => $realPath,
                'sha256' => $hash,
                'sizeBytes' => (int) $fileInfo->getSize(),
            ];
        }

        return $files;
    }

    /**
     * Pass two: emit the archive straight into a gzip stream, one file at a
     * time, so nothing larger than a single chunk is ever resident. The byte
     * format is identical to the buffered writer, so restore/verify/preview and
     * previously written backups are unaffected.
     *
     * @param  array<string, mixed>  $manifest
     * @param  array<string, list<array<string, mixed>>>  $tables
     * @param  list<array{path: string, realPath: string, sha256: string, sizeBytes: int}>  $fileMeta
     */
    private function writeStreamedArchive(string $path, array $manifest, array $tables, array $fileMeta): string
    {
        $encrypted = (bool) config('archive.backups.encryption_enabled');
        $plainPath = $encrypted ? $this->tempArchivePath() : $path;

        $handle = gzopen($plainPath, 'wb9');

        if ($handle === false) {
            throw new BackupException('Failed to open backup file for writing.', 500);
        }

        if ($encrypted) {
            @chmod($plainPath, 0600);
        }

        try {
            $write = static function (string $chunk) use ($handle): void {
                if (gzwrite($handle, $chunk) === false) {
                    throw new BackupException('Failed to write backup stream.', 500);
                }
            };

            // One JSON document per line. A single-document archive can only be
            // parsed by loading all of it, which is what made restore impossible
            // on any real archive; line-delimited entries let the reader work
            // one bounded record at a time.
            $write(json_encode([
                'format' => self::NDJSON_FORMAT,
                'manifest' => $manifest,
            ], JSON_THROW_ON_ERROR)."\n");

            foreach ($tables as $table => $rows) {
                $write(json_encode([
                    'kind' => 'table',
                    'name' => $table,
                    'rows' => $rows,
                ], JSON_THROW_ON_ERROR)."\n");
            }

            foreach ($fileMeta as $meta) {
                $write('{"kind":"file","path":'.json_encode($meta['path'], JSON_THROW_ON_ERROR)
                    .',"sha256":'.json_encode($meta['sha256'], JSON_THROW_ON_ERROR)
                    .',"sizeBytes":'.$meta['sizeBytes']
                    .',"contentBase64":"');

                $source = fopen($meta['realPath'], 'rb');

                if ($source === false) {
                    throw new BackupException('Failed to read backup source file.', 500);
                }

                try {
                    // Chunk size MUST stay a multiple of 3: base64 encodes in
                    // 3-byte groups, and only aligned chunks concatenate into a
                    // valid encoding. A ragged chunk would pad mid-stream and
                    // silently corrupt the restored file.
                    while (! feof($source)) {
                        $chunk = fread($source, 3 * 1024 * 1024);

                        if ($chunk === false) {
                            throw new BackupException('Failed to read backup source file.', 500);
                        }

                        if ($chunk !== '') {
                            $write(base64_encode($chunk));
                        }
                    }
                } finally {
                    fclose($source);
                }

                $write("\"}\n");
            }
        } catch (JsonException $e) {
            gzclose($handle);
            @unlink($plainPath);

            throw new BackupException('Failed to serialize backup snapshot: '.$e->getMessage(), 500);
        } catch (\Throwable $e) {
            gzclose($handle);
            // Never leave a short archive behind that later reads would trust.
            @unlink($plainPath);

            throw $e;
        }

        gzclose($handle);

        if ($encrypted) {
            try {
                $this->streamEncryptFile($plainPath, $path);
            } finally {
                @unlink($plainPath);
            }
        }

        $checksum = hash_file('sha256', $path);

        if ($checksum === false) {
            throw new BackupException('Failed to checksum backup file.', 500);
        }

        return $checksum;
    }

    private function tempArchivePath(): string
    {
        return sys_get_temp_dir().DIRECTORY_SEPARATOR.'archive-backup-'.bin2hex(random_bytes(8)).'.tmp';
    }

    /**
     * V2-204: streams $plainPath through AES-256-GCM in fixed-size chunks
     * into $outPath, so encrypting a multi-gigabyte archive never holds more
     * than one chunk in memory (unlike the old Crypt::encrypt(whole-string)
     * call it replaces). Each chunk is independently authenticated; the AAD
     * binds the chunk's index (rejects reordering) and a final-chunk flag
     * (rejects truncation) -- both checked on decrypt.
     */
    private function streamEncryptFile(string $plainPath, string $outPath): void
    {
        $key = $this->encryptionKey();
        $in = fopen($plainPath, 'rb');

        if ($in === false) {
            throw new BackupException('Failed to open plain archive for encryption.', 500);
        }

        $out = fopen($outPath, 'wb');

        if ($out === false) {
            fclose($in);

            throw new BackupException('Failed to open backup file for writing.', 500);
        }

        try {
            if (fwrite($out, self::ENC_MAGIC) === false) {
                throw new BackupException('Failed to write backup stream.', 500);
            }

            $pending = fread($in, self::ENC_CHUNK_SIZE);

            if ($pending === false) {
                throw new BackupException('Failed to read plain archive.', 500);
            }

            $index = 0;

            do {
                $current = $pending;
                $pending = feof($in) ? '' : fread($in, self::ENC_CHUNK_SIZE);

                if ($pending === false) {
                    throw new BackupException('Failed to read plain archive.', 500);
                }

                $isFinal = $pending === '';
                $this->writeEncryptedChunk($out, $key, $current, $index, $isFinal);
                $index++;
            } while (! $isFinal);
        } finally {
            fclose($in);
            fclose($out);
        }
    }

    /**
     * @param  resource  $out
     */
    private function writeEncryptedChunk($out, string $key, string $plaintext, int $index, bool $isFinal): void
    {
        $nonce = random_bytes(12);
        $aad = ($isFinal ? "\x01" : "\x00").pack('N', $index);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, $aad, 16);

        if ($ciphertext === false) {
            throw new BackupException('Failed to encrypt backup chunk.', 500);
        }

        $frame = $aad.$nonce.$ciphertext.$tag;

        if (fwrite($out, pack('N', strlen($frame)).$frame) === false) {
            throw new BackupException('Failed to write backup stream.', 500);
        }
    }

    /**
     * V2-204 read side: decrypts $encPath chunk-by-chunk into a fresh temp
     * file the caller must unlink, verifying each chunk's AEAD tag and
     * index as it goes. Throws before returning if the stream ends without
     * an authenticated final-chunk marker (truncation) or a chunk's index
     * doesn't match what's expected (reordering) or a tag fails to verify
     * (tampering/corruption/wrong key).
     */
    private function streamDecryptToTemp(string $encPath): string
    {
        $key = $this->encryptionKey();
        $in = fopen($encPath, 'rb');

        if ($in === false) {
            throw new BackupException('Failed to open backup file for reading.', 500);
        }

        $tempPath = $this->tempArchivePath();
        $out = fopen($tempPath, 'wb');

        if ($out === false) {
            fclose($in);

            throw new BackupException('Failed to open temporary file for decryption.', 500);
        }

        @chmod($tempPath, 0600);

        try {
            $magic = fread($in, strlen(self::ENC_MAGIC));

            if ($magic !== self::ENC_MAGIC) {
                throw new BackupException('Backup file is corrupt or unreadable.', 422);
            }

            $index = 0;
            $sawFinal = false;

            while (true) {
                $chunk = $this->readEncryptedChunk($in, $key, $index);

                if ($chunk === null) {
                    break;
                }

                if (fwrite($out, $chunk['plaintext']) === false) {
                    throw new BackupException('Failed to write decrypted archive.', 500);
                }

                $index++;

                if ($chunk['isFinal']) {
                    $sawFinal = true;

                    break;
                }
            }

            if (! $sawFinal) {
                throw new BackupException('Backup file is truncated or corrupt.', 422);
            }
        } catch (\Throwable $e) {
            fclose($in);
            fclose($out);
            @unlink($tempPath);

            throw $e;
        }

        fclose($in);
        fclose($out);

        return $tempPath;
    }

    /**
     * @param  resource  $in
     * @return array{plaintext: string, isFinal: bool}|null null means clean EOF (no more chunks)
     */
    private function readEncryptedChunk($in, string $key, int $expectedIndex): ?array
    {
        $lengthRaw = fread($in, 4);

        if ($lengthRaw === false || $lengthRaw === '') {
            return null;
        }

        if (strlen($lengthRaw) !== 4) {
            throw new BackupException('Backup file is corrupt or unreadable.', 422);
        }

        $length = unpack('N', $lengthRaw)[1];
        $frame = $this->readExactly($in, $length);

        if (strlen($frame) < 5 + 12 + 16) {
            throw new BackupException('Backup file is corrupt or unreadable.', 422);
        }

        $aad = substr($frame, 0, 5);
        $nonce = substr($frame, 5, 12);
        $tag = substr($frame, -16);
        $ciphertext = substr($frame, 17, -16);

        $index = unpack('N', substr($aad, 1, 4))[1];

        if ($index !== $expectedIndex) {
            throw new BackupException('Backup file is corrupt or unreadable (chunk order).', 422);
        }

        $plaintext = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, $aad);

        if ($plaintext === false) {
            throw new BackupException('Backup file failed integrity verification.', 422);
        }

        return ['plaintext' => $plaintext, 'isFinal' => $aad[0] === "\x01"];
    }

    /**
     * @param  resource  $handle
     */
    private function readExactly($handle, int $length): string
    {
        $data = '';

        while (strlen($data) < $length) {
            $piece = fread($handle, $length - strlen($data));

            if ($piece === false || $piece === '') {
                throw new BackupException('Backup file is corrupt or unreadable.', 422);
            }

            $data .= $piece;
        }

        return $data;
    }

    private function isChunkedEncryptedArchive(string $path): bool
    {
        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            return false;
        }

        $head = fread($handle, strlen(self::ENC_MAGIC));
        fclose($handle);

        return $head === self::ENC_MAGIC;
    }

    /**
     * Same key material Illuminate\Encryption\Encrypter derives from APP_KEY,
     * reused directly so V2-204's streamed AEAD format needs no secret of
     * its own to manage or rotate separately from the app's existing key.
     */
    private function encryptionKey(): string
    {
        $key = (string) config('app.key');

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);
            $key = $decoded === false ? '' : $decoded;
        }

        if (strlen($key) !== 32) {
            throw new BackupException('APP_KEY is not a 32-byte key; cannot encrypt backups.', 500);
        }

        return $key;
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
    /**
     * Single definition of "this entry is intact", shared by the streamed and
     * buffered restore paths so the rule cannot drift between them.
     *
     * @param  array<string, mixed>  $file
     */
    private function assertFileEntryIntact(array $file): void
    {
        $content = base64_decode((string) ($file['contentBase64'] ?? ''), true);
        $expected = (string) ($file['sha256'] ?? '');

        if ($content === false || $expected === '' || ! hash_equals($expected, hash('sha256', $content))) {
            throw new BackupException(
                'Backup file entry "'.((string) ($file['path'] ?? '?')).'" failed checksum verification. Restore aborted; live data was not touched.',
                422
            );
        }
    }

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

        if ($this->isChunkedEncryptedArchive($path)) {
            $tempPath = $this->streamDecryptToTemp($path);

            try {
                return $this->readNdjsonArchive($tempPath);
            } finally {
                @unlink($tempPath);
            }
        }

        if ($this->isNdjsonArchive($path)) {
            return $this->readNdjsonArchive($path);
        }

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
     * Peek at the first bytes only. Sniffing by reading the whole archive would
     * reintroduce exactly the memory blow-up this format exists to avoid, and
     * encrypted archives are never line-delimited because Crypt wraps the whole
     * blob.
     */
    private function isNdjsonArchive(string $path): bool
    {
        if ((bool) config('archive.backups.encryption_enabled')) {
            return false;
        }

        $handle = @gzopen($path, 'rb');

        if ($handle === false) {
            return false;
        }

        $head = (string) gzread($handle, 64);
        gzclose($handle);

        return str_starts_with($head, '{"format":"'.self::NDJSON_FORMAT.'"');
    }

    /**
     * Yields one decoded record per line, so peak memory is a single record
     * rather than the whole archive.
     *
     * @return \Generator<int, array<string, mixed>>
     */
    private function streamNdjsonRecords(string $path): \Generator
    {
        $handle = @gzopen($path, 'rb');

        if ($handle === false) {
            throw new BackupException('Backup file is corrupt or unreadable.', 422);
        }

        try {
            while (($line = gzgets($handle)) !== false) {
                $line = trim($line);

                if ($line === '') {
                    continue;
                }

                try {
                    $record = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
                } catch (JsonException) {
                    throw new BackupException('Backup file does not contain valid JSON.', 422);
                }

                if (! is_array($record)) {
                    throw new BackupException('Backup file does not contain a valid snapshot.', 422);
                }

                yield $record;
            }
        } finally {
            gzclose($handle);
        }
    }

    /**
     * Structural read for preview/restore metadata. File CONTENT is deliberately
     * dropped here -- only restore needs the bytes, and it streams them
     * separately so nothing large is ever resident.
     *
     * @return array{tables: array<string, list<array<string, mixed>>>, files: list<array<string, mixed>>, manifest: array<string, mixed>|null}
     */
    private function readNdjsonArchive(string $path): array
    {
        $manifest = null;
        $tables = [];
        $files = [];

        foreach ($this->streamNdjsonRecords($path) as $record) {
            if (isset($record['format'])) {
                $manifest = is_array($record['manifest'] ?? null) ? $record['manifest'] : null;

                continue;
            }

            $kind = $record['kind'] ?? null;

            if ($kind === 'table' && is_string($record['name'] ?? null) && is_array($record['rows'] ?? null)) {
                $tables[$record['name']] = array_values(array_filter($record['rows'], 'is_array'));

                continue;
            }

            if ($kind === 'file') {
                unset($record['contentBase64']);
                $files[] = $record;
            }
        }

        return ['tables' => $tables, 'files' => $files, 'manifest' => $manifest];
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
