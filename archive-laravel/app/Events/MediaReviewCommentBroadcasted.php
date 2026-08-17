<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * V3-MEDIA-003: fired whenever a studio timeline comment is created,
 * resolved, reopened, edited, or deleted, so the studio's timeline panel
 * updates live. The frontend also polls as a reconnect-and-reconcile
 * fallback when this channel is unreachable -- see StudioTimelinePanel's
 * docblock -- so no client can silently miss an update.
 */
class MediaReviewCommentBroadcasted implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    /**
     * @param  array<string, mixed>  $comment  Formatted comment payload (null body when action is "deleted").
     */
    public function __construct(
        public readonly string $recordUid,
        public readonly string $action,
        public readonly ?array $comment,
        public readonly ?string $commentId = null,
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('media-review-comments.'.$this->recordUid),
        ];
    }

    public function broadcastAs(): string
    {
        return 'media-review-comment.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'recordUid' => $this->recordUid,
            'action' => $this->action,
            'comment' => $this->comment,
            'commentId' => $this->commentId ?? $this->comment['id'] ?? null,
        ];
    }
}
