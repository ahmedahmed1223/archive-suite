<?php

declare(strict_types=1);

namespace App\Services\Backup;

/**
 * Disaster-recovery readiness probe: last backup + last restore-test result.
 * Reuses BackupService's existing backup directory; the restore marker is a
 * tiny JSON file written by BackupService::restore() callers (SystemController)
 * so this stays infra-free (no new table, no new dependency).
 */
class DrReadinessService
{
    private const MARKER_FILE = 'dr-restore-test.json';

    public function __construct(private readonly BackupService $backups)
    {
    }

    /**
     * @return array{lastBackupAt: string|null, lastBackupName: string|null, lastRestoreTestAt: string|null, lastRestoreTestOk: bool|null}
     */
    public function probe(): array
    {
        $backups = $this->backups->list();
        $latest = $backups[0] ?? null;

        $marker = $this->readMarker();

        return [
            'lastBackupAt' => $latest['createdAt'] ?? null,
            'lastBackupName' => $latest['name'] ?? null,
            'lastRestoreTestAt' => $marker['at'] ?? null,
            'lastRestoreTestOk' => $marker['ok'] ?? null,
        ];
    }

    public function recordRestoreTest(bool $ok): void
    {
        $path = $this->directory().DIRECTORY_SEPARATOR.self::MARKER_FILE;

        file_put_contents($path, json_encode([
            'at' => now()->toIso8601String(),
            'ok' => $ok,
        ], JSON_THROW_ON_ERROR));
    }

    /**
     * @return array{at?: string, ok?: bool}
     */
    private function readMarker(): array
    {
        $path = $this->directory().DIRECTORY_SEPARATOR.self::MARKER_FILE;

        if (! is_file($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $decoded : [];
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
