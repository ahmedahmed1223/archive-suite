<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SystemControlApiTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupDir = storage_path('framework/testing/control-'.uniqid());
        config(['archive.backup_path' => $this->backupDir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupDir);

        parent::tearDown();
    }

    public function test_control_actions_are_disabled_by_default_even_for_admins(): void
    {
        config(['archive.system_control_enabled' => false]);

        $this->postJson('/api/v1/system/control/clear-cache', [], $this->adminHeaders())
            ->assertStatus(503)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('error', 'System control actions are disabled.');

        $this->assertSame(
            'rejected',
            AuditLog::query()->latest('id')->first()?->outcome,
        );
        $this->assertSame(
            'system_control.blocked',
            AuditLog::query()->latest('id')->first()?->event,
        );
    }

    public function test_control_actions_are_blocked_for_non_admins_even_when_enabled(): void
    {
        config(['archive.system_control_enabled' => true]);

        $this->postJson('/api/v1/system/control/clear-cache', [], $this->viewerHeaders())
            ->assertForbidden();

        $log = AuditLog::query()->latest('id')->first();
        $this->assertSame('rejected', $log?->outcome);
        $this->assertSame(403, $log?->status_code);
    }

    public function test_enabled_admin_can_run_clear_cache_action_and_it_is_audit_logged(): void
    {
        config(['archive.system_control_enabled' => true]);

        $this->postJson('/api/v1/system/control/clear-cache', [], $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('result.action', 'clear-cache');

        $log = AuditLog::query()->latest('id')->first();
        $this->assertSame('system_control.allowed', $log?->event);
        $this->assertSame('success', $log?->outcome);
        $this->assertSame('clear-cache', $log?->resource_id);
    }

    public function test_enabled_admin_can_trigger_backup_action(): void
    {
        config(['archive.system_control_enabled' => true]);

        $this->postJson('/api/v1/system/control/run-backup', [], $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('result.action', 'run-backup');
    }

    public function test_unknown_action_is_rejected(): void
    {
        config(['archive.system_control_enabled' => true]);

        $this->postJson('/api/v1/system/control/nuke-everything', [], $this->adminHeaders())
            ->assertStatus(422)
            ->assertJsonPath('ok', false);
    }

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'control-admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Viewer',
            'email' => 'control-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($viewer)];
    }

    private function tokenFor(User $user): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return $login->json('accessToken');
    }
}
