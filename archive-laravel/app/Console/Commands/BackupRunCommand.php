<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Console\Commands\Concerns\EmitsBackupResult;
use App\Services\Backup\BackupException;
use App\Services\Backup\BackupService;
use Illuminate\Console\Command;
use Throwable;

/**
 * V1-208H: Setup's CLI has no HTTP session, so it cannot go through
 * BackupsController — this wraps BackupService::run() directly. The backup
 * itself already covers DB + local files + manifest + checksums (see
 * BackupService::run()); this command just exposes that as a legal
 * replacement for the raw pg_dump Setup used to shell out to.
 */
class BackupRunCommand extends Command
{
    use EmitsBackupResult;

    protected $signature = 'archive:backup-run {--json : Print a single JSON result line to stdout instead of narration}';

    protected $description = 'Create a full legal backup (DB + files + manifest + checksums) via BackupService';

    public function handle(BackupService $backups): int
    {
        $json = (bool) $this->option('json');

        try {
            $backup = $backups->run();
        } catch (BackupException $e) {
            return $this->emitFailure($json, 'BACKUP_FAILED', $e->getMessage());
        } catch (Throwable $e) {
            report($e);

            return $this->emitFailure($json, 'BACKUP_FAILED', 'Backup failed unexpectedly. See server logs for details.');
        }

        return $this->emitSuccess($json, 'BACKUP_CREATED', "Backup created: {$backup['name']}", ['backup' => $backup]);
    }
}
