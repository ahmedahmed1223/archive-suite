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

    public function notify(?string $resourceFailure = null): void
    {
        $counts = MediaJob::query()
            ->whereIn('status', ['queued', 'processing'])
            ->whereNotNull('queue')
            ->selectRaw('queue, count(*) as total')
            ->groupBy('queue')
            ->pluck('total', 'queue');

        MediaQueueStatusUpdated::dispatch([
            'default' => (int) ($counts['default'] ?? 0),
            'gpu' => (int) ($counts['gpu'] ?? 0),
            'device' => $this->securitySettings->getSettings()['whisperDevice'],
            'resourceFailure' => $resourceFailure,
        ]);
    }
}
