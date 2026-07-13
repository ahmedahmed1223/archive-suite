<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\MediaJob;
use Illuminate\Console\Command;

/**
 * V1-123: retention for the media_jobs table. Only terminal jobs
 * (completed/failed/canceled) whose completed_at is older than
 * config('media.job_retention_days') are deleted. queued/processing rows are
 * excluded by the status filter alone, so an in-flight job is never at risk
 * regardless of how old queued_at is.
 */
class MediaJobsPruneCommand extends Command
{
    protected $signature = 'media:prune-jobs';

    protected $description = 'Delete terminal media_jobs rows older than the configured retention window';

    private const TERMINAL_STATUSES = ['completed', 'failed', 'canceled'];

    public function handle(): int
    {
        $days = (int) config('media.job_retention_days', 90);
        $cutoff = now()->subDays($days);

        $deleted = MediaJob::query()
            ->whereIn('status', self::TERMINAL_STATUSES)
            ->where('completed_at', '<', $cutoff)
            ->delete();

        $this->info("Pruned {$deleted} media job(s) older than {$days} days.");

        return 0;
    }
}
