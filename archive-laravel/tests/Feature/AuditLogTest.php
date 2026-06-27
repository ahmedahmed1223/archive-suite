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
            'status_code' => 200,
        ]);
    }

    public function test_it_does_not_audit_safe_reads(): void
    {
        $this->getJson('/api/v1/records?store=archive-items', $this->authHeaders())->assertOk();

        $this->assertSame(0, DB::table('audit_logs')->count());
    }

}
