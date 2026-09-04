<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Events\MediaJobProgressUpdated;
use App\Models\MediaJob;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * RT-801: pairs a MediaJob progress/status write with the broadcast that
 * tells subscribed Next.js clients about it, so every call site that
 * changes progress updates the DB and notifies together — never one
 * without the other.
 */
class MediaJobProgressBroadcaster
{
    public function __construct(private readonly MediaQueueStatusBroadcaster $queueStatus) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(MediaJob $job, array $attributes): void
    {
        $job->update($attributes);
        $this->notify($job);
    }

    public function notify(MediaJob $job): void
    {
        try {
            MediaJobProgressUpdated::dispatch($job->id, $job->toApiPayload());
        } catch (Throwable $exception) {
            Log::warning('Media job realtime notification failed; clients will use polling.', [
                'job_id' => $job->id,
                'exception' => $exception::class,
            ]);
        }

        // RT-802: any status transition changes queue occupancy — completed/
        // failed/canceled free a slot, processing moves one out of "queued".
        $this->queueStatus->notify();
    }
}
