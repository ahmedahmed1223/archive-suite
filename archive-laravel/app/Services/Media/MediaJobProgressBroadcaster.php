<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Events\MediaJobProgressUpdated;
use App\Models\MediaJob;

/**
 * RT-801: pairs a MediaJob progress/status write with the broadcast that
 * tells subscribed Next.js clients about it, so every call site that
 * changes progress updates the DB and notifies together — never one
 * without the other.
 */
class MediaJobProgressBroadcaster
{
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
        MediaJobProgressUpdated::dispatch($job->id, $job->toApiPayload());
    }
}
