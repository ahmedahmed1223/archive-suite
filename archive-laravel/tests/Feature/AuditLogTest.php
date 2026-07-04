<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class AuditLogTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_audits_mutating_archive_api_requests(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'audit-1', 'title' => 'Audited']],
        ], $this->authHeaders())->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'POST /api/v1/records/bulk',
            'event' => 'records.bulk_upsert',
            'resource_type' => 'record',
            'resource_id' => 'audit-1',
            'outcome' => 'success',
            'status_code' => 200,
        ]);
    }

    public function test_it_classifies_resource_specific_audit_events(): void
    {
        $this->postJson('/api/v1/rights', [
            'itemId' => 'rights-audit-1',
            'rightsHolder' => 'Archive Team',
            'licenseType' => 'OWNED',
        ], $this->authHeaders())->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'rights.upsert',
            'resource_type' => 'rights_record',
            'resource_id' => 'rights-audit-1',
            'outcome' => 'success',
            'status_code' => 201,
        ]);
    }

    public function test_it_does_not_audit_safe_reads(): void
    {
        $this->getJson('/api/v1/records?store=archive-items', $this->authHeaders())->assertOk();

        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_it_redacts_sensitive_request_metadata(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [[
                'uid' => 'audit-redaction-1',
                'title' => 'Redaction test',
                'secretToken' => 'do-not-store-this',
            ]],
        ], $this->authHeaders())->assertOk();

        $metadata = DB::table('audit_logs')->latest('id')->value('metadata');
        $this->assertIsString($metadata);
        $decoded = json_decode($metadata, true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame('[redacted]', $decoded['request']['records'][0]['secretToken']);
        $this->assertSame('Redaction test', $decoded['request']['records'][0]['title']);
        $this->assertSame(true, $decoded['restoreDecision']['available']);
        $this->assertContains('records.0.title', $decoded['diff']['fields']);
    }

}
