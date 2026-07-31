<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordEditClaimApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_a_record_with_no_claim_returns_null(): void
    {
        $this->getJson('/api/v1/records/item-1/edit-claim', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('claim', null);
    }

    public function test_it_claims_reads_and_releases(): void
    {
        $this->postJson('/api/v1/records/item-1/edit-claim', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('claim.recordId', 'item-1');

        $this->getJson('/api/v1/records/item-1/edit-claim', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('claim.recordId', 'item-1');

        $this->deleteJson('/api/v1/records/item-1/edit-claim', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/records/item-1/edit-claim', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('claim', null);
    }

    public function test_an_expired_claim_is_not_returned(): void
    {
        $this->postJson('/api/v1/records/item-1/edit-claim', [], $this->authHeaders())->assertOk();
        DB::table('record_edit_claims')->where('record_id', 'item-1')->update(['expires_at' => now()->subMinute()]);

        $this->getJson('/api/v1/records/item-1/edit-claim', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('claim', null);
    }
}
