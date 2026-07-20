<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Exceptions\ScheduledUploadConflict;
use App\Jobs\FinalizeScheduledUpload;
use App\Models\ScheduledUpload;
use App\Services\Uploads\ScheduledUploadState;
use Illuminate\Console\Command;
use Illuminate\Contracts\Bus\Dispatcher as BusDispatcher;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * V1-712 Task 4: claims due scheduled uploads in bounded batches and pushes
 * one FinalizeScheduledUpload job per claim.
 *
 * Claiming reuses ScheduledUploadState::transition()'s atomic
 * compare-and-swap (a single `UPDATE ... WHERE status = 'scheduled' AND
 * version = ?`) as the only race-safety mechanism. That single-row
 * conditional UPDATE is already race-safe for concurrent dispatcher runs on
 * any DB driver (SQLite, MySQL, PostgreSQL alike): only one concurrent
 * UPDATE can match a given row's (status, version) pair, so a second
 * dispatcher racing on the same candidate gets 0 rows affected -> a
 * stale_version conflict -- and is skipped rather than double-claiming.
 * Pessimistic locking (`SELECT ... FOR UPDATE SKIP LOCKED`) would only cut
 * down on wasted candidate scans under heavy contention; it isn't needed for
 * correctness at this batch size/cadence (every minute), and the test
 * environment's SQLite driver doesn't support SKIP LOCKED at all.
 */
class DispatchScheduledUploads extends Command
{
    protected $signature = 'uploads:dispatch-scheduled';

    protected $description = 'Claim due scheduled uploads in bounded batches and dispatch the finalize job for each.';

    public function handle(ScheduledUploadState $state, BusDispatcher $bus): int
    {
        $ceiling = (int) config('scheduled-uploads.dispatch_queue_depth_ceiling', 5000);
        $inFlight = ScheduledUpload::query()->whereIn('status', ['claimed', 'processing'])->count();

        if ($inFlight >= $ceiling) {
            $this->info("Skipping dispatch: {$inFlight} scheduled upload(s) already in flight (ceiling {$ceiling}).");

            return 0;
        }

        $batch = (int) config('scheduled-uploads.batch', 100);
        $queue = (string) config('scheduled-uploads.queue', 'scheduled-uploads');
        $leaseSeconds = (int) config('scheduled-uploads.lease_seconds', 1800);

        $candidates = ScheduledUpload::query()
            ->where('status', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->orderBy('scheduled_at')
            ->orderBy('id')
            ->limit($batch)
            ->get(['id', 'version']);

        $claimed = 0;

        foreach ($candidates as $candidate) {
            try {
                $state->transition($candidate->id, 'scheduled', 'claimed', $candidate->version, [
                    'lease_expires_at' => now()->addSeconds($leaseSeconds),
                ]);
            } catch (ScheduledUploadConflict) {
                // Lost the claim race to a concurrent dispatcher run -- not ours to dispatch.
                continue;
            }

            try {
                $bus->dispatch((new FinalizeScheduledUpload($candidate->id))->onQueue($queue));
                $claimed++;
            } catch (Throwable $exception) {
                Log::error('Failed to push scheduled upload job; releasing claim back to scheduled.', [
                    'scheduleId' => $candidate->id,
                    'exception' => $exception,
                ]);

                $this->releaseClaim($state, $candidate->id);
            }
        }

        $this->info("Dispatched {$claimed} scheduled upload(s).");

        return 0;
    }

    private function releaseClaim(ScheduledUploadState $state, string $id): void
    {
        $current = ScheduledUpload::query()->find($id);

        if ($current === null || $current->status !== 'claimed') {
            return;
        }

        try {
            $state->transition($id, 'claimed', 'scheduled', $current->version);
        } catch (ScheduledUploadConflict) {
            // Already moved on concurrently (e.g. recovered by the watchdog) -- nothing to do.
        }
    }
}
