<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class CollaborationPresenceUpdated implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    /**
     * @param array<string, mixed> $participant Single participant delta — keep payload minimal.
     */
    public function __construct(
        public readonly string $roomKey,
        public readonly array $participant,
    ) {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('collaboration.room.'.$this->roomKey),
        ];
    }

    public function broadcastAs(): string
    {
        return 'presence.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'roomKey' => $this->roomKey,
            'participant' => $this->participant,
        ];
    }
}
