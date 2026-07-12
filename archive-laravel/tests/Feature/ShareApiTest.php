<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class ShareApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_and_reads_a_public_share_payload(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'item-1', 'title' => 'Shared clip'],
                ['uid' => 'item-2', 'title' => 'Private clip'],
            ],
        ], $this->authHeaders())->assertOk();

        $response = $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
            'permission' => 'view',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure(['token', 'url', 'path']);

        $token = $response->json('token');
        $this->assertIsString($token);

        $this->getJson('/api/v1/share/'.$token)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('permission', 'view')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'item-1');
    }

    public function test_public_share_endpoint_is_rate_limited(): void
    {
        // 30 requests/minute; the 31st in the window is rejected with 429,
        // blunting token-guessing brute force against the public share reader.
        for ($i = 0; $i < 30; $i++) {
            $this->getJson('/api/v1/share/nonexistent-token')->assertNotFound();
        }

        $this->getJson('/api/v1/share/nonexistent-token')->assertStatus(429);
    }

    public function test_it_hides_expired_share_links(): void
    {
        $response = $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
            'expiresAt' => now()->subMinute()->toISOString(),
        ], $this->authHeaders())->assertCreated();

        $this->getJson('/api/v1/share/'.$response->json('token'))
            ->assertNotFound()
            ->assertJsonPath('ok', false);
    }

    public function test_it_rejects_unauthenticated_share_creation(): void
    {
        $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
        ])->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_password_protected_share_is_readable_via_header(): void
    {
        $token = $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
            'password' => 'correct horse battery',
        ], $this->authHeaders())->assertCreated()->json('token');

        $this->getJson('/api/v1/share/'.$token, ['X-Share-Password' => 'correct horse battery'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->getJson('/api/v1/share/'.$token, ['X-Share-Password' => 'wrong'])
            ->assertStatus(401);

        $this->getJson('/api/v1/share/'.$token)
            ->assertStatus(401);
    }

    public function test_password_protected_share_query_fallback_still_works(): void
    {
        // ponytail: covers the deprecated query-string fallback; delete this test alongside the fallback removal in v1.1.
        $token = $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
            'password' => 'fallback-secret',
        ], $this->authHeaders())->assertCreated()->json('token');

        $this->getJson('/api/v1/share/'.$token.'?password=fallback-secret')
            ->assertOk()
            ->assertJsonPath('ok', true);
    }
}
