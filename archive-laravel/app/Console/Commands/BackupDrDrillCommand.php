<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Backup\BackupService;
use App\Services\Backup\DrReadinessService;
use Illuminate\Console\Command;

/**
 * Run a disaster-recovery drill: restore latest backup and verify.
 * Safe: restores to temp state then rolls back.
 */
class BackupDrDrillCommand extends Command
{
    protected $signature = 'backup:dr-drill';

    protected $description = 'Run a DR drill: restore latest backup and verify';

    public function handle(BackupService $backups, DrReadinessService $dr): int
    {
        $this->info('Starting DR drill...');

        try {
            $result = $dr->runDrDrill($backups);

            if ($result['passed']) {
                $this->info('✓ DR drill passed');
                $this->line("Latest backup: {$result['latestBackupName']}");

                return 0;
            } else {
                $this->warn('✗ DR drill failed');
                $this->line("Message: {$result['message']}");

                return 1;
            }
        } catch (\Exception $e) {
            $this->error("DR drill error: {$e->getMessage()}");

            return 1;
        }
    }
}
