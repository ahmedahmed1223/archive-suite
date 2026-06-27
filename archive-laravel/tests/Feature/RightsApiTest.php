<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RightsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_upserts_and_fetches_a_rights_record(): void
    {
        $payload = [
            'itemId' => 'item-1',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'OWNED',
            'geoRestrictions' => ['SA', 'AE'],
            'notes' => 'Internal production rights.',
        ];

        $this->postJson('/api/v1/rights', $payload)
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('record.itemId', 'item-1')
            ->assertJsonPath('record.licenseType', 'OWNED');

        $this->getJson('/api/v1/rights?itemId=item-1')
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
        ])->assertCreated();

        $this->postJson('/api/v1/rights', [
            'itemId' => 'item-later',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'LICENSED',
            'expiresAt' => now()->addDays(90)->toISOString(),
        ])->assertCreated();

        $this->getJson('/api/v1/rights/expiring?days=30')
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
        ])->assertCreated();

        $this->getJson('/api/v1/rights/item-expired/enforcement')
            ->assertOk()
            ->assertJsonPath('allowed', false)
            ->assertJsonPath('blocked', true)
            ->assertJsonPath('reason', 'expired');
    }
}
