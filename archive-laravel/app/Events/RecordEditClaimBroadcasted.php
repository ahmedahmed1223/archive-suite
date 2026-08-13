<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * RT-804: pushes RecordEditClaimController's claim/release onto the record's
 * own channel, so another viewer sees who's editing without polling.
 */
class RecordEditClaimBroadcasted implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    /**
     * @param  array<string, mixed>|null  $claim
     */
    public function __construct(
        public readonly string $recordId,
        public readonly ?array $claim,
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('record-edit.'.$this->recordId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'record-edit.changed';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['claim' => $this->claim];
    }
}
