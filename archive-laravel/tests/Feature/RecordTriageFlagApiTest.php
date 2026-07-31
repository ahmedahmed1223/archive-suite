<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordTriageFlagApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_a_record_with_no_flag_returns_null(): void
    {
        $this->getJson('/api/v1/records/item-1/triage-flag', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('flag', null);
    }

    public function test_it_sets_reads_and_clears_a_flag(): void
    {
        $this->putJson('/api/v1/records/item-1/triage-flag', ['reason' => 'ينقصه تاريخ التسجيل'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('flag.recordId', 'item-1')
            ->assertJsonPath('flag.reason', 'ينقصه تاريخ التسجيل');

        $this->getJson('/api/v1/records/item-1/triage-flag', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('flag.reason', 'ينقصه تاريخ التسجيل');

        $this->deleteJson('/api/v1/records/item-1/triage-flag', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/records/item-1/triage-flag', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('flag', null);
    }

    public function test_setting_the_flag_again_replaces_the_reason(): void
    {
        $this->putJson('/api/v1/records/item-1/triage-flag', ['reason' => 'سبب أول'], $this->authHeaders())->assertOk();
        $this->putJson('/api/v1/records/item-1/triage-flag', ['reason' => 'سبب محدث'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('flag.reason', 'سبب محدث');
    }

    public function test_it_rejects_an_empty_reason(): void
    {
        $this->putJson('/api/v1/records/item-1/triage-flag', ['reason' => ''], $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_clearing_an_unflagged_record_returns_not_found(): void
    {
        $this->deleteJson('/api/v1/records/item-1/triage-flag', [], $this->authHeaders())
            ->assertStatus(404);
    }
}
