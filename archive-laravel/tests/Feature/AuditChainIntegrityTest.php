<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class AuditChainIntegrityTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_verify_chain_passes_for_an_untampered_log(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'chain-1', 'title' => 'Chain test 1']],
        ], $this->authHeaders())->assertOk();

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'chain-2', 'title' => 'Chain test 2']],
        ], $this->authHeaders())->assertOk();

        $rows = DB::table('audit_logs')->orderBy('id')->get();
        $this->assertGreaterThanOrEqual(2, $rows->count());
        $this->assertNull($rows->first()->prev_hash);
        $this->assertNotNull($rows->first()->hash);
        $this->assertSame($rows->first()->hash, $rows->skip(1)->first()->prev_hash);

        $this->artisan('audit:verify-chain')->assertExitCode(0);
    }

    public function test_verify_chain_detects_a_tampered_row(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'chain-3', 'title' => 'Chain test 3']],
        ], $this->authHeaders())->assertOk();

        $tampered = DB::table('audit_logs')->orderBy('id')->first();
        DB::table('audit_logs')->where('id', $tampered->id)->update(['outcome' => 'tampered']);

        $this->artisan('audit:verify-chain', ['--json' => true])
            ->assertExitCode(1)
            ->expectsOutputToContain((string) $tampered->id);
    }

    public function test_verify_chain_detects_a_deleted_row(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'chain-4', 'title' => 'Chain test 4']],
        ], $this->authHeaders())->assertOk();

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'chain-5', 'title' => 'Chain test 5']],
        ], $this->authHeaders())->assertOk();

        $first = DB::table('audit_logs')->orderBy('id')->first();
        DB::table('audit_logs')->where('id', $first->id)->delete();

        $this->artisan('audit:verify-chain')->assertExitCode(1);
    }
}
