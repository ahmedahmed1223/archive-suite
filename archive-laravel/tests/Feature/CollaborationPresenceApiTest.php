<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Events\CollaborationPresenceUpdated;
use App\Models\CollaborationPresence;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CollaborationPresenceApiTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $email = 'editor@example.test'): string
    {
        User::query()->create([
            'name' => 'Archive Editor',
            'email' => $email,
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password',
        ])->assertOk();

        $token = $response->json('accessToken');
        $this->assertIsString($token);

        return $token;
    }

    public function test_presence_requires_authentication(): void
    {
        $this->getJson('/api/v1/collaboration/rooms/review-1/presence')
            ->assertUnauthorized();

        $this->postJson('/api/v1/collaboration/rooms/review-1/presence', [
            'status' => 'reviewing',
        ])->assertUnauthorized();
    }

    public function test_heartbeat_broadcasts_presence_update(): void
    {
        Event::fake([CollaborationPresenceUpdated::class]);

        $accessToken = $this->login();

        $this->postJson('/api/v1/collaboration/rooms/review-1/presence', [
            'status' => 'reviewing',
            'resourceId' => 'media-123',
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])->assertOk();

        Event::assertDispatched(CollaborationPresenceUpdated::class, function (CollaborationPresenceUpdated $event): bool {
            return $event->roomKey === 'review-1'
                && $event->participant['status'] === 'reviewing'
                && $event->participant['resourceId'] === 'media-123'
                && in_array('private-collaboration.room.review-1', array_map(
                    fn ($channel) => $channel->name,
                    $event->broadcastOn()
                ), true);
        });
    }

    public function test_heartbeat_creates_and_lists_current_participant(): void
    {
        $accessToken = $this->login();

        $this->postJson('/api/v1/collaboration/rooms/review-1/presence', [
            'status' => 'reviewing',
            'resourceId' => 'media-123',
            'cursor' => ['timecodeSeconds' => 12.5],
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('roomKey', 'review-1')
            ->assertJsonPath('participants.0.displayName', 'Archive Editor')
            ->assertJsonPath('participants.0.status', 'reviewing')
            ->assertJsonPath('participants.0.resourceId', 'media-123')
            ->assertJsonPath('participants.0.cursor.timecodeSeconds', 12.5);

        $this->assertDatabaseHas('collaboration_presence', [
            'room_key' => 'review-1',
            'status' => 'reviewing',
            'resource_id' => 'media-123',
        ]);
    }

    public function test_heartbeat_updates_existing_presence_for_same_user_and_room(): void
    {
        $accessToken = $this->login();

        $this->postJson('/api/v1/collaboration/rooms/review-1/presence', [
            'status' => 'viewing',
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])->assertOk();

        $this->postJson('/api/v1/collaboration/rooms/review-1/presence', [
            'status' => 'editing',
            'resourceId' => 'record-9',
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonCount(1, 'participants')
            ->assertJsonPath('participants.0.status', 'editing')
            ->assertJsonPath('participants.0.resourceId', 'record-9');

        $this->assertSame(1, CollaborationPresence::query()->where('room_key', 'review-1')->count());
    }

    public function test_list_filters_out_stale_participants(): void
    {
        $accessToken = $this->login();

        CollaborationPresence::query()->create([
            'id' => 'presence-stale',
            'room_key' => 'review-1',
            'user_id' => User::query()->firstOrFail()->id,
            'display_name' => 'Stale User',
            'status' => 'idle',
            'last_seen_at' => now()->subSeconds(90),
        ]);

        $this->getJson('/api/v1/collaboration/rooms/review-1/presence', [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('participants', []);
    }
}
