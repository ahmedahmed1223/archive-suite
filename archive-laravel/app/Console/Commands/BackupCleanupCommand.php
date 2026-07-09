<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Enforce backup retention policies: max-count and max-age.
 * Deletes oldest backups when limits exceeded, with audit logging.
 *
 * ponytail: Minimal cleanup — glob list, sort by name (timestamp),
 * delete oldest until under limit. Audit log is a simple text file.
 */
class BackupCleanupCommand extends Command
{
    protected $signature = 'backup:cleanup {--dry-run}';

    protected $description = 'Enforce backup retention policies (max-count, max-age)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $backupDir = (string) config('archive.backup_path');
        $maxCount = (int) config('archive.backups.max_count', 30);
        $maxAgeDays = (int) config('archive.backups.max_age_days', 90);

        if (! is_dir($backupDir)) {
            $this->info('Backup directory does not exist.');

            return 0;
        }

        $files = glob($backupDir.DIRECTORY_SEPARATOR.'backup-*.json.gz') ?: [];

        if (empty($files)) {
            $this->info('No backups to clean.');

            return 0;
        }

        // Sort by name (descending) so oldest is last
        rsort($files);

        $deleted = [];
        $now = now();
        $cutoffDate = $now->clone()->subDays($maxAgeDays);

        // Delete by age first
        foreach ($files as $file) {
            if (count($files) - count($deleted) <= $maxCount) {
                break; // Stop if we're under the limit
            }

            $mtime = (int) filemtime($file);
            $fileTime = \Carbon\Carbon::createFromTimestamp($mtime);

            if ($fileTime->isBefore($cutoffDate)) {
                $deleted[] = basename($file);

                if (! $dryRun) {
                    $this->deleteBackupFile($file);
                }
            }
        }

        // Delete excess by count
        while (count($files) - count($deleted) > $maxCount) {
            $file = end($files);

            if (! $file || in_array(basename($file), $deleted)) {
                array_pop($files);
                continue;
            }

            $deleted[] = basename($file);

            if (! $dryRun) {
                $this->deleteBackupFile($file);
            }

            array_pop($files);
        }

        // Log deletions
        if (! empty($deleted)) {
            $this->logDeletions($deleted, $dryRun);
        }

        $count = count($deleted);

        if ($dryRun) {
            $this->info("Dry run: would delete {$count} backups.");
        } else {
            $this->info("Deleted {$count} backups.");
        }

        return 0;
    }

    private function deleteBackupFile(string $path): void
    {
        File::delete($path);

        // Also delete checksum sidecar
        File::delete($path.'.sha256');
    }

    /**
     * @param  list<string>  $files
     */
    private function logDeletions(array $files, bool $dryRun): void
    {
        $backupDir = (string) config('archive.backup_path');
        $logFile = $backupDir.DIRECTORY_SEPARATOR.'cleanup.log';

        $timestamp = now()->toIso8601String();
        $action = $dryRun ? 'DRY-RUN' : 'DELETED';

        foreach ($files as $file) {
            $line = "{$timestamp} | {$action} | {$file}\n";
            File::append($logFile, $line);
        }
    }
}
