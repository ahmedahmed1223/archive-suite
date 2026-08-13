<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * RT-801: fired whenever a media job's status or progress changes, so
 * Next.js can show live upload/OCR/Whisper/extraction progress instead of
 * relying on a manual refresh. Dispatched explicitly by
 * MediaJobProgressBroadcaster at each write site — never from a model
 * observer — matching how RecordChanged is dispatched only from its two
 * deliberate call sites (see that class's docblock).
 */
class MediaJobProgressUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;

    /**
     * @param  array<string, mixed>  $job  MediaJob::toApiPayload() shape.
     */
    public function __construct(
        public readonly string $jobId,
        public readonly array $job,
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('media-job.'.$this->jobId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'media-job.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'job' => $this->job,
        ];
    }
}
