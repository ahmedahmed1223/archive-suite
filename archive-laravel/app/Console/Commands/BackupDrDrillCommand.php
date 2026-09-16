<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Backup\BackupService;
use App\Services\Backup\DrReadinessService;
use Illuminate\Console\Command;

/**
 * Run a disaster-recovery drill: restore the latest backup and time it.
 *
 * NOT safe on a live database. It performs a real restore over whatever is
 * there — that is what makes the measured duration a real RTO — so it requires
 * --force and belongs on a disposable environment.
 */
class BackupDrDrillCommand extends Command
{
    protected $signature = 'backup:dr-drill {--force : Required — this restores over the current database}';

    protected $description = 'Run a DR drill on a disposable environment: restore the latest backup and measure RTO';

    public function handle(BackupService $backups, DrReadinessService $dr): int
    {
        if (! $this->option('force')) {
            $this->error('A DR drill restores the latest backup over the current database.');
            $this->line('Run it only against a disposable environment, then pass --force.');

            return 1;
        }

        $this->info('Starting DR drill...');

        try {
            $result = $dr->runDrDrill($backups, true);

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
