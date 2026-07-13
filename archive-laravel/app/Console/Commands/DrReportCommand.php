<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Backup\DrReadinessService;
use Illuminate\Console\Command;

/**
 * V1-123: prints the current RPO/RTO exposure. RPO is measured directly
 * (age of the most recent backup). RTO is the duration of the last DR drill
 * (backup:dr-drill) when one has been run, otherwise reported as
 * not-yet-measured rather than guessed.
 */
class DrReportCommand extends Command
{
    protected $signature = 'dr:report';

    protected $description = 'Report current RPO (backup age) and RTO (last DR drill duration)';

    public function handle(DrReadinessService $dr): int
    {
        $report = $dr->rpoRtoReport();

        $rpo = $report['rpoHours'] === null
            ? 'no successful backup yet (unbounded exposure)'
            : "{$report['rpoHours']} hours (last backup: {$report['lastBackupAt']})";

        $rto = $report['rtoSeconds'] === null
            ? 'not yet measured — run backup:dr-drill'
            : "{$report['rtoSeconds']} seconds (measured {$report['rtoMeasuredAt']})";

        $this->line("RPO: {$rpo}");
        $this->line("RTO: {$rto}");
        $this->line("RTO source: {$report['rtoSource']}");

        return 0;
    }
}
