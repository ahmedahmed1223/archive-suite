<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SafetyPreviewApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_editor_can_list_the_exact_synthetic_scenarios(): void
    {
        $this->getJson('/api/v1/safety-preview/scenarios', $this->headersFor('editor', 'editor@example.test'))
            ->assertOk()
            ->assertJsonPath('synthetic', true)
            ->assertExactJson([
                'synthetic' => true,
                'scenarios' => ['bulk-delete-basic', 'restore-conflict'],
            ]);
    }

    public function test_administrator_can_run_a_synthetic_preview(): void
    {
        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'bulk-delete-basic',
            'operation' => 'delete',
            'ids' => ['alpha'],
        ], $this->headersFor('admin', 'admin@example.test'))
            ->assertOk()
            ->assertJsonPath('synthetic', true)
            ->assertJsonPath('results.0.id', 'alpha')
            ->assertJsonPath('results.0.deleted', true);
    }

    public function test_unauthenticated_requests_are_denied(): void
    {
        $this->getJson('/api/v1/safety-preview/scenarios')->assertUnauthorized();
        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'bulk-delete-basic', 'operation' => 'delete', 'ids' => ['alpha'],
        ])->assertUnauthorized();
    }

    public function test_viewer_requests_are_forbidden(): void
    {
        $headers = $this->headersFor('viewer', 'viewer@example.test');

        $this->getJson('/api/v1/safety-preview/scenarios', $headers)->assertForbidden();
        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'bulk-delete-basic', 'operation' => 'delete', 'ids' => ['alpha'],
        ], $headers)->assertForbidden();
    }

    public function test_delete_preview_is_deterministic_and_deduplicates_ids_in_request_order(): void
    {
        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'bulk-delete-basic',
            'operation' => 'delete',
            'ids' => ['bravo', 'alpha', 'bravo', 'missing'],
        ], $this->editorHeaders())
            ->assertOk()
            ->assertJsonPath('before.live', 3)
            ->assertJsonPath('before.trash', 0)
            ->assertJsonPath('after.live', 1)
            ->assertJsonPath('after.trash', 2)
            ->assertJsonPath('results.0.id', 'bravo')
            ->assertJsonPath('results.0.deleted', true)
            ->assertJsonPath('results.1.id', 'alpha')
            ->assertJsonPath('results.1.deleted', true)
            ->assertJsonPath('results.2.id', 'missing')
            ->assertJsonPath('results.2.deleted', false)
            ->assertJsonPath('results.2.reason', 'not_found');
    }

    public function test_restore_preview_reports_conflicts_and_missing_items(): void
    {
        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'restore-conflict',
            'operation' => 'restore',
            'ids' => ['conflict', 'recoverable', 'missing'],
        ], $this->editorHeaders())
            ->assertOk()
            ->assertJsonPath('before.live', 1)
            ->assertJsonPath('before.trash', 2)
            ->assertJsonPath('after.live', 2)
            ->assertJsonPath('after.trash', 1)
            ->assertJsonPath('results.0.id', 'conflict')
            ->assertJsonPath('results.0.restored', false)
            ->assertJsonPath('results.0.reason', 'conflict')
            ->assertJsonPath('results.1.id', 'recoverable')
            ->assertJsonPath('results.1.restored', true)
            ->assertJsonPath('results.2.reason', 'not_found');
    }

    public function test_preview_expiry_is_an_iso_8601_timestamp_fifteen_minutes_ahead(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-22T10:00:00+00:00'));

        try {
            $expiresAt = $this->postJson('/api/v1/safety-preview/run', [
                'scenario' => 'bulk-delete-basic', 'operation' => 'delete', 'ids' => ['alpha'],
            ], $this->editorHeaders())->assertOk()->json('expiresAt');

            $this->assertIsString($expiresAt);
            $this->assertSame('2026-07-22T10:15:00+00:00', $expiresAt);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_run_validates_its_request_payload(): void
    {
        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'unknown', 'operation' => 'purge', 'ids' => ['', 42],
        ], $this->editorHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['scenario', 'operation', 'ids.0', 'ids.1']);
    }

    public function test_preview_runs_leave_live_and_trashed_database_records_unchanged(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items', 'uid' => 'real-live', 'data' => json_encode(['uid' => 'real-live']),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('trashed_records')->insert([
            'store' => 'archive-items', 'uid' => 'real-trash', 'data' => json_encode(['uid' => 'real-trash']),
            'deleted_at' => now(), 'original_created_at' => now(), 'original_updated_at' => now(),
        ]);
        $beforeLive = DB::table('storage_rows')->orderBy('uid')->get()->map(fn ($row) => (array) $row)->all();
        $beforeTrash = DB::table('trashed_records')->orderBy('uid')->get()->map(fn ($row) => (array) $row)->all();

        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'bulk-delete-basic', 'operation' => 'delete', 'ids' => ['alpha'],
        ], $this->editorHeaders())->assertOk();
        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'restore-conflict', 'operation' => 'restore', 'ids' => ['recoverable'],
        ], $this->editorHeaders())->assertOk();

        $this->assertSame($beforeLive, DB::table('storage_rows')->orderBy('uid')->get()->map(fn ($row) => (array) $row)->all());
        $this->assertSame($beforeTrash, DB::table('trashed_records')->orderBy('uid')->get()->map(fn ($row) => (array) $row)->all());
    }

    public function test_preview_run_does_not_write_an_audit_log(): void
    {
        $headers = $this->editorHeaders();
        $before = DB::table('audit_logs')->count();

        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'bulk-delete-basic', 'operation' => 'delete', 'ids' => ['alpha'],
        ], $headers)->assertOk();

        $this->assertSame($before, DB::table('audit_logs')->count());
    }

    private function editorHeaders(): array
    {
        return $this->headersFor('editor', 'editor-preview@example.test');
    }

    private function headersFor(string $role, string $email): array
    {
        $user = User::query()->firstOrCreate(['email' => $email], [
            'name' => ucfirst($role), 'password' => Hash::make('secret-password'), 'role' => $role,
        ]);
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
