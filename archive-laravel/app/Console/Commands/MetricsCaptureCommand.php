<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\SystemMetricSample;
use App\Services\System\SystemMetricsService;
use Illuminate\Console\Command;

/**
 * V1-756: appends one storage sample so the reports page has a series to fit
 * a growth trend to. Scheduled hourly; MetricsPruneCommand bounds the table.
 */
class MetricsCaptureCommand extends Command
{
    protected $signature = 'metrics:capture';

    protected $description = 'Record the current storage usage as a history sample';

    public function handle(SystemMetricsService $metrics): int
    {
        $disk = $metrics->snapshot()['disk'];
        $total = (int) ($disk['totalBytes'] ?? 0);
        $used = (int) ($disk['usedBytes'] ?? 0);

        // SystemMetricsService reports 0/0 when the host read fails. Storing
        // that would tell the forecast storage collapsed to zero and is now
        // shrinking — a trend invented out of a failure. Skip, don't record.
        if ($total <= 0) {
            $this->warn('Disk usage is unreadable; skipped rather than recording a zero sample.');

            return 0;
        }

        SystemMetricSample::query()->create([
            'captured_at' => now(),
            'disk_used_bytes' => max(0, $used),
            'disk_total_bytes' => $total,
        ]);

        $this->info("Recorded storage sample: {$used}/{$total} bytes.");

        return 0;
    }
}
