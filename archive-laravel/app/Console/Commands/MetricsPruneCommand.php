<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\SystemMetricSample;
use Illuminate\Console\Command;

/**
 * V1-756: retention for system_metric_samples. The sampler appends hourly, so
 * without this the table grows without bound — retention that never runs is
 * the same bug as no retention at all. Default 90 days: long enough to fit a
 * seasonal storage trend, short enough to stay small.
 */
class MetricsPruneCommand extends Command
{
    protected $signature = 'metrics:prune';

    protected $description = 'Delete storage samples older than the configured retention window';

    public function handle(): int
    {
        $days = (int) config('archive.metric_sample_retention_days', 90);
        $cutoff = now()->subDays($days);

        $deleted = SystemMetricSample::query()->where('captured_at', '<', $cutoff)->delete();

        $this->info("Pruned {$deleted} storage sample(s) older than {$days} days.");

        return 0;
    }
}
