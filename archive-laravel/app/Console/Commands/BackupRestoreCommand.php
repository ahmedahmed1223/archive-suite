<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Console\Commands\Concerns\EmitsBackupResult;
use App\Services\Backup\BackupException;
use App\Services\Backup\BackupService;
use Illuminate\Console\Command;
use Throwable;

/**
 * V1-208H: Setup-side restore, replacing the raw `psql < dump.sql` pipe.
 * BackupService::restore() already refuses a checksum-mismatched backup
 * before touching any live data (see BackupService::restore()) — this
 * command doesn't duplicate that guard, it just surfaces the result.
 *
 * --force is required because this runs non-interactively from Setup; the
 * human confirmation prompt already happened on the Node/Setup side before
 * this command is ever invoked.
 */
class BackupRestoreCommand extends Command
{
    use EmitsBackupResult;

    protected $signature = 'archive:backup-restore {name : Backup file name to restore} {--force : Required — confirms this destructive, non-interactive restore} {--json : Print a single JSON result line to stdout instead of narration}';

    protected $description = 'Restore a legal backup via BackupService; refuses to run without --force and refuses a corrupt backup before touching data';

    public function handle(BackupService $backups): int
    {
        $json = (bool) $this->option('json');
        $name = (string) $this->argument('name');

        if (! $this->option('force')) {
            return $this->emitFailure(
                $json,
                'FORCE_REQUIRED',
                'Restore is destructive and requires --force when run non-interactively; confirm interactively in Setup first.'
            );
        }

        try {
            $result = $backups->restore($name);
        } catch (BackupException $e) {
            return $this->emitFailure($json, 'RESTORE_FAILED', $e->getMessage());
        } catch (Throwable $e) {
            report($e);

            return $this->emitFailure($json, 'RESTORE_FAILED', 'Restore failed unexpectedly. See server logs for details.');
        }

        return $this->emitSuccess($json, 'RESTORE_COMPLETE', "Restore complete: {$result['name']}", ['result' => $result]);
    }
}
