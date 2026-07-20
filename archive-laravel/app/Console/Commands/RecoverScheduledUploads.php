<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Exceptions\ScheduledUploadConflict;
use App\Models\ScheduledUpload;
use App\Services\Uploads\ScheduledUploadState;
use Illuminate\Console\Command;

/**
 * V1-712 Task 4: watchdog for lost/crashed workers. A row only sits in
 * 'claimed' between the dispatcher's claim and the job transitioning it to
 * 'processing' -- if a worker crashed or was killed before that transition,
 * or never picked the job up at all, the claim's lease_expires_at (set at
 * claim time) eventually passes with the row stuck. This releases it back
 * to 'scheduled' so the next dispatcher run picks it up again.
 *
 * Scoped to 'claimed' only, not 'processing': a job that reached
 * 'processing' and then failed is retried by Laravel's own queue
 * tries/backoff, and a permanently exhausted retry is handled by the job's
 * failed() callback -- this command isn't the recovery path for those.
 */
class RecoverScheduledUploads extends Command
{
    protected $signature = 'uploads:recover-scheduled';

    protected $description = 'Return scheduled uploads with an expired claim lease back to scheduled.';

    public function handle(ScheduledUploadState $state): int
    {
        $expired = ScheduledUpload::query()
            ->where('status', 'claimed')
            ->where('lease_expires_at', '<', now())
            ->get(['id', 'version']);

        $recovered = 0;

        foreach ($expired as $row) {
            try {
                $state->transition($row->id, 'claimed', 'scheduled', $row->version, ['lease_expires_at' => null]);
                $recovered++;
            } catch (ScheduledUploadConflict) {
                // Already moved on concurrently -- nothing to do.
                continue;
            }
        }

        $this->info("Recovered {$recovered} scheduled upload(s) with an expired claim lease.");

        return 0;
    }
}
