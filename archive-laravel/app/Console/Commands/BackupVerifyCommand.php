<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Console\Commands\Concerns\EmitsBackupResult;
use App\Services\Backup\BackupException;
use App\Services\Backup\BackupService;
use Illuminate\Console\Command;
use Throwable;

/**
 * V1-208H: `setup verify-backup` — checks a backup's SHA-256 checksum via
 * BackupService::verify() without touching live data. A corrupt/tampered
 * backup (checksum mismatch) or a verify failure (missing/invalid name)
 * both exit non-zero, so Setup can refuse to proceed with a restore.
 */
class BackupVerifyCommand extends Command
{
    use EmitsBackupResult;

    protected $signature = 'archive:backup-verify {name : Backup file name, e.g. backup-2026-01-01T00-00-00-000000.json.gz} {--json : Print a single JSON result line to stdout instead of narration}';

    protected $description = 'Verify a backup\'s checksum via BackupService, rejecting a corrupt backup before any restore';

    public function handle(BackupService $backups): int
    {
        $json = (bool) $this->option('json');
        $name = (string) $this->argument('name');

        try {
            $verification = $backups->verify($name);
        } catch (BackupException $e) {
            return $this->emitFailure($json, 'BACKUP_VERIFY_ERROR', $e->getMessage());
        } catch (Throwable $e) {
            report($e);

            return $this->emitFailure($json, 'BACKUP_VERIFY_ERROR', 'Verification failed unexpectedly. See server logs for details.');
        }

        if (! $verification['verified']) {
            return $this->emitFailure($json, 'BACKUP_UNVERIFIED', $verification['message'], ['verification' => $verification]);
        }

        return $this->emitSuccess($json, 'BACKUP_VERIFIED', $verification['message'], ['verification' => $verification]);
    }
}
