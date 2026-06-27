<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShareApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['archive.api_key' => 'test-secret']);
    }

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
            ->assertJsonStructure(['token', 'shareUrl', 'path']);

        $token = $response->json('token');
        $this->assertIsString($token);

        $this->getJson('/api/v1/share/'.$token)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('permission', 'view')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'item-1');
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

    /**
     * @return array<string, string>
     */
    private function authHeaders(): array
    {
        return ['X-Archive-Api-Key' => 'test-secret'];
    }
}
