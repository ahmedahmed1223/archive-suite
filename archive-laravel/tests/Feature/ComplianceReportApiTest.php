<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ComplianceReportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_filter_and_summarize_operational_compliance_events(): void
    {
        DB::table('audit_logs')->insert([
            [
                'action' => 'POST /api/v1/rights',
                'event' => 'rights.upsert',
                'resource_type' => 'rights_record',
                'resource_id' => 'record-1',
                'actor_id' => 11,
                'outcome' => 'success',
                'status_code' => 201,
                'metadata' => json_encode(['request' => ['secret' => '[redacted]']]),
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Sensitive agent',
                'created_at' => '2026-07-01 10:00:00',
            ],
            [
                'action' => 'POST /api/v1/rights',
                'event' => 'rights.upsert',
                'resource_type' => 'rights_record',
                'resource_id' => 'record-2',
                'actor_id' => 12,
                'outcome' => 'rejected',
                'status_code' => 422,
                'metadata' => null,
                'ip_address' => null,
                'user_agent' => null,
                'created_at' => '2026-07-02 10:00:00',
            ],
            [
                'action' => 'POST /api/v1/media/jobs',
                'event' => 'media.workflow.queue',
                'resource_type' => 'media_job',
                'resource_id' => 'record-3',
                'actor_id' => 11,
                'outcome' => 'failed',
                'status_code' => 500,
                'metadata' => null,
                'ip_address' => null,
                'user_agent' => null,
                'created_at' => '2026-06-30 10:00:00',
            ],
        ]);

        $response = $this->getJson('/api/v1/reports/compliance?from=2026-07-01&to=2026-07-02&event=rights.upsert', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.outcomes.success', 1)
            ->assertJsonPath('summary.outcomes.rejected', 1)
            ->assertJsonPath('summary.outcomes.failed', 0)
            ->assertJsonPath('entries.0.event', 'rights.upsert')
            ->assertJsonPath('filters.from', '2026-07-01')
            ->assertJsonPath('filters.to', '2026-07-02');

        $this->assertSame(2, $response->json('summary.events')['rights.upsert']);
    }

    public function test_csv_export_uses_the_same_filters_without_sensitive_audit_payloads(): void
    {
        DB::table('audit_logs')->insert([
            'action' => 'POST /api/v1/rights',
            'event' => 'rights.upsert',
            'resource_type' => 'rights_record',
            'resource_id' => 'record-export',
            'actor_id' => 11,
            'outcome' => 'success',
            'status_code' => 201,
            'metadata' => json_encode(['request' => ['authorization' => '[redacted]']]),
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Sensitive agent',
            'created_at' => '2026-07-01 10:00:00',
        ]);

        $response = $this->get('/api/v1/reports/compliance/export?event=rights.upsert', $this->adminHeaders());

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment;', (string) $response->headers->get('content-disposition'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('event,resource_type,resource_id,actor_id,outcome,status_code,action,created_at', $csv);
        $this->assertStringContainsString('rights.upsert', $csv);
        $this->assertStringNotContainsString('Sensitive agent', $csv);
        $this->assertStringNotContainsString('127.0.0.1', $csv);
        $this->assertStringNotContainsString('authorization', $csv);
    }

    public function test_compliance_report_requires_an_admin(): void
    {
        $this->getJson('/api/v1/reports/compliance')->assertUnauthorized();
        $this->getJson('/api/v1/reports/compliance', $this->viewerHeaders())->assertForbidden();
    }

    /** @return array<string, string> */
    private function adminHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->tokenFor('admin', 'compliance-admin@example.test')];
    }

    /** @return array<string, string> */
    private function viewerHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->tokenFor('viewer', 'compliance-viewer@example.test')];
    }

    private function tokenFor(string $role, string $email): string
    {
        $user = User::query()->create([
            'name' => ucfirst($role),
            'email' => $email,
            'password' => Hash::make('secret-password'),
            'role' => $role,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');
    }
}
