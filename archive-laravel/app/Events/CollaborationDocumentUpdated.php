<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class CollaborationDocumentUpdated implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    /**
     * @param array<string, mixed> $document
     */
    public function __construct(
        public readonly string $roomKey,
        public readonly array $document,
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
        return 'document.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'roomKey' => $this->roomKey,
            'document' => $this->document,
        ];
    }
}
