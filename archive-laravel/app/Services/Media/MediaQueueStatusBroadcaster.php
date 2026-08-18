<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Events\MediaQueueStatusUpdated;
use App\Models\MediaJob;
use App\Services\Security\SecuritySettingsService;

/**
 * RT-802: single choke point for the media-queue-status broadcast —
 * MediaJobsController::store() calls it when a job is queued,
 * MediaJobProgressBroadcaster calls it on every subsequent transition (a
 * completed/failed/canceled job frees a queue slot too), and
 * ProcessMediaWorkflow passes a resource-failure message when a GPU job
 * can't run.
 */
class MediaQueueStatusBroadcaster
{
    public function __construct(private readonly SecuritySettingsService $securitySettings) {}

    /**
     * Current queued+processing depth per queue. Single choke-point query,
     * reused by notify() (the broadcast payload), MediaJobsController's
     * backpressure check (V3-PERF-005), and the queue-status poll fallback.
     *
     * @return array{default: int, gpu: int}
     */
    public function counts(): array
    {
        $counts = MediaJob::query()
            ->whereIn('status', ['queued', 'processing'])
            ->whereNotNull('queue')
            ->selectRaw('queue, count(*) as total')
            ->groupBy('queue')
            ->pluck('total', 'queue');

        return [
            'default' => (int) ($counts['default'] ?? 0),
            'gpu' => (int) ($counts['gpu'] ?? 0),
        ];
    }

    /**
     * V3-PERF-005: RT-802's status was push-only (no GET counterpart), so a
     * client without a live Reverb connection had no way to ever populate the
     * queue-status panel. This is the snapshot the new poll-fallback GET
     * endpoint returns — same shape as the broadcast payload, minus the
     * inherently transient resourceFailure (a poll has no "just now" event to
     * report).
     *
     * @return array{default: int, gpu: int, device: string, resourceFailure: null}
     */
    public function status(): array
    {
        return [
            ...$this->counts(),
            'device' => $this->securitySettings->getSettings()['whisperDevice'],
            'resourceFailure' => null,
        ];
    }

    public function notify(?string $resourceFailure = null): void
    {
        MediaQueueStatusUpdated::dispatch([
            ...$this->counts(),
            'device' => $this->securitySettings->getSettings()['whisperDevice'],
            'resourceFailure' => $resourceFailure,
        ]);
    }
}
