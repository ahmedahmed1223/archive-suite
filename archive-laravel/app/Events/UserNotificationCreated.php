<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * RT-804: pushes a Notification row to its owner's private channel as soon
 * as NotificationService creates it, replacing the 30s poll in
 * useNotifications with an immediate update (poll stays as a fallback).
 */
class UserNotificationCreated implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    /**
     * @param  array<string, mixed>  $notification
     */
    public function __construct(
        public readonly string $userId,
        public readonly array $notification,
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('notifications.'.$this->userId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification.created';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['notification' => $this->notification];
    }
}
