<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RightsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['archive.api_key' => 'test-secret']);
    }

    public function test_it_upserts_and_fetches_a_rights_record(): void
    {
        $payload = [
            'itemId' => 'item-1',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'OWNED',
            'geoRestrictions' => ['SA', 'AE'],
            'notes' => 'Internal production rights.',
        ];

        $this->postJson('/api/v1/rights', $payload, $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('record.itemId', 'item-1')
            ->assertJsonPath('record.licenseType', 'OWNED');

        $this->getJson('/api/v1/rights?itemId=item-1', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.rightsHolder', 'Archive Team')
            ->assertJsonPath('record.geoRestrictions.0', 'SA');
    }

    public function test_it_lists_expiring_rights_records(): void
    {
        $this->postJson('/api/v1/rights', [
            'itemId' => 'item-expiring',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'LICENSED',
            'expiresAt' => now()->addDays(7)->toISOString(),
        ], $this->authHeaders())->assertCreated();

        $this->postJson('/api/v1/rights', [
            'itemId' => 'item-later',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'LICENSED',
            'expiresAt' => now()->addDays(90)->toISOString(),
        ], $this->authHeaders())->assertCreated();

        $this->getJson('/api/v1/rights/expiring?days=30', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.itemId', 'item-expiring');
    }

    public function test_it_blocks_expired_rights_in_enforcement(): void
    {
        $this->postJson('/api/v1/rights', [
            'itemId' => 'item-expired',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'LICENSED',
            'expiresAt' => now()->subDay()->toISOString(),
        ], $this->authHeaders())->assertCreated();

        $this->getJson('/api/v1/rights/item-expired/enforcement', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('allowed', false)
            ->assertJsonPath('blocked', true)
            ->assertJsonPath('reason', 'expired');
    }

    public function test_it_rejects_unauthenticated_rights_requests(): void
    {
        $this->getJson('/api/v1/rights?itemId=item-1')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_it_reports_missing_api_key_configuration(): void
    {
        config(['archive.api_key' => null]);

        $this->getJson('/api/v1/rights?itemId=item-1', $this->authHeaders())
            ->assertStatus(503)
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
