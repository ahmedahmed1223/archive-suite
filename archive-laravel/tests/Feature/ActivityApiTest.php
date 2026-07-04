<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class ActivityApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_lists_filterable_audit_activity(): void
    {
        $this->postJson('/api/v1/rights', [
            'itemId' => 'activity-record-1',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'OWNED',
        ], $this->authHeaders())->assertCreated();

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'activity-record-1',
            'operation' => 'thumbnail',
        ], $this->authHeaders())->assertCreated();

        $this->getJson('/api/v1/activity?event=rights.upsert&resourceId=activity-record-1&limit=10', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('filters.event', 'rights.upsert')
            ->assertJsonPath('filters.resourceId', 'activity-record-1')
            ->assertJsonPath('entries.0.event', 'rights.upsert')
            ->assertJsonPath('entries.0.resourceType', 'rights_record')
            ->assertJsonPath('entries.0.resourceId', 'activity-record-1')
            ->assertJsonPath('entries.0.metadata.restoreDecision.available', true);
    }

    public function test_it_rejects_unauthenticated_activity_requests(): void
    {
        $this->getJson('/api/v1/activity')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_activity_reads_are_not_audited(): void
    {
        $this->getJson('/api/v1/activity', $this->authHeaders())->assertOk();

        $this->assertSame(0, DB::table('audit_logs')->count());
    }
}
