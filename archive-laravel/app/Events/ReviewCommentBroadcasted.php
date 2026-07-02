<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class ReviewCommentBroadcasted implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    /**
     * @param array<string, mixed> $comment Formatted review comment payload.
     */
    public function __construct(
        public readonly string $mediaUid,
        public readonly array $comment,
    ) {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('review.media.'.$this->mediaUid),
        ];
    }

    public function broadcastAs(): string
    {
        return 'review-comment.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'mediaUid' => $this->mediaUid,
            'comment' => $this->comment,
        ];
    }
}
