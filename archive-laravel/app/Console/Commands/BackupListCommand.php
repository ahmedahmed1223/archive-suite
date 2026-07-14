<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Console\Commands\Concerns\EmitsBackupResult;
use App\Services\Backup\BackupService;
use Illuminate\Console\Command;
use Throwable;

/**
 * V1-208H: Setup-side listing of legal backups (name, size, createdAt,
 * checksum) via BackupService::list(), for scripts/control-center to render
 * instead of reading raw .sql files off the host filesystem.
 */
class BackupListCommand extends Command
{
    use EmitsBackupResult;

    protected $signature = 'archive:backup-list {--json : Print a single JSON result line to stdout instead of narration}';

    protected $description = 'List available legal backups via BackupService';

    public function handle(BackupService $backups): int
    {
        $json = (bool) $this->option('json');

        try {
            $list = $backups->list();
        } catch (Throwable $e) {
            return $this->emitFailure($json, 'BACKUP_LIST_FAILED', 'Failed to list backups: '.$e->getMessage());
        }

        if (! $json) {
            if ($list === []) {
                $this->components->info('No backups yet.');
            } else {
                foreach ($list as $index => $backup) {
                    $this->line(sprintf(
                        '%2d) %s  (%s, %s)',
                        $index + 1,
                        $backup['name'],
                        $backup['createdAt'],
                        $backup['checksum'] ? 'checksum on file' : 'no checksum sidecar'
                    ));
                }
            }
        }

        return $this->emitSuccess($json, 'BACKUP_LIST', count($list).' backup(s) found.', ['backups' => $list]);
    }
}
