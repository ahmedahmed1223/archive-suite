<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\CollaborationLock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CollaborationLocksApiTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $email, string $name): string
    {
        User::query()->create([
            'name' => $name,
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

    public function test_locks_require_authentication(): void
    {
        $this->getJson('/api/v1/collaboration/rooms/review-1/locks')->assertUnauthorized();
        $this->postJson('/api/v1/collaboration/rooms/review-1/locks', [
            'resourceId' => 'record-1',
        ])->assertUnauthorized();
    }

    public function test_user_can_acquire_and_release_a_resource_lock(): void
    {
        $accessToken = $this->login('editor@example.test', 'Archive Editor');

        $this->postJson('/api/v1/collaboration/rooms/review-1/locks', [
            'resourceId' => 'record-1',
            'ttlSeconds' => 120,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('lock.resourceId', 'record-1')
            ->assertJsonPath('lock.displayName', 'Archive Editor');

        $this->getJson('/api/v1/collaboration/rooms/review-1/locks', [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonCount(1, 'locks')
            ->assertJsonPath('locks.0.resourceId', 'record-1');

        $this->postJson('/api/v1/collaboration/rooms/review-1/locks/release', [
            'resourceId' => 'record-1',
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('released', true)
            ->assertJsonPath('locks', []);

        $this->assertDatabaseMissing('collaboration_locks', [
            'room_key' => 'review-1',
            'resource_id' => 'record-1',
        ]);
    }

    public function test_lock_conflict_returns_409_for_another_active_user(): void
    {
        $firstToken = $this->login('first@example.test', 'First Editor');
        $secondToken = $this->login('second@example.test', 'Second Editor');

        $this->postJson('/api/v1/collaboration/rooms/review-1/locks', [
            'resourceId' => 'record-1',
        ], [
            'Authorization' => 'Bearer '.$firstToken,
        ])->assertCreated();

        $this->postJson('/api/v1/collaboration/rooms/review-1/locks', [
            'resourceId' => 'record-1',
        ], [
            'Authorization' => 'Bearer '.$secondToken,
        ])
            ->assertStatus(409)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'lock_conflict')
            ->assertJsonPath('lock.displayName', 'First Editor');
    }

    public function test_same_user_refreshes_existing_lock(): void
    {
        $accessToken = $this->login('editor@example.test', 'Archive Editor');

        $this->postJson('/api/v1/collaboration/rooms/review-1/locks', [
            'resourceId' => 'record-1',
            'ttlSeconds' => 30,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])->assertCreated();

        $this->postJson('/api/v1/collaboration/rooms/review-1/locks', [
            'resourceId' => 'record-1',
            'ttlSeconds' => 180,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('lock.resourceId', 'record-1');

        $this->assertSame(1, CollaborationLock::query()->where('resource_id', 'record-1')->count());
    }
}
