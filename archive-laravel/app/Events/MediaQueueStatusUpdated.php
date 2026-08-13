<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * RT-802: aggregate CPU/GPU media-job queue depth, the configured whisper
 * device, and the last GPU resource failure (if any) — broadcast on a
 * single shared status channel, never per-job data.
 */
class MediaQueueStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;

    /**
     * @param  array<string, mixed>  $status
     */
    public function __construct(public readonly array $status) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('media-queue-status')];
    }

    public function broadcastAs(): string
    {
        return 'media-queue.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['status' => $this->status];
    }
}
