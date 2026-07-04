<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SystemStatusApiTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupDir = storage_path('framework/testing/status-'.uniqid());
        config(['archive.backup_path' => $this->backupDir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupDir);

        parent::tearDown();
    }

    public function test_admin_can_read_live_status_metrics(): void
    {
        $this->getJson('/api/v1/system/status', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure([
                'metrics' => ['cpuLoad', 'memory' => ['usedBytes', 'totalBytes'], 'disk' => ['usedBytes', 'totalBytes'], 'queueDepth'],
                'dr' => ['lastBackupAt', 'lastBackupName', 'lastRestoreTestAt', 'lastRestoreTestOk'],
            ]);
    }

    public function test_dr_probe_reports_last_backup_after_a_backup_runs(): void
    {
        $headers = $this->adminHeaders();

        $this->postJson('/api/v1/system/backups/run', [], $headers)->assertCreated();

        $this->getJson('/api/v1/system/dr-probe', $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('dr.lastRestoreTestOk', null);

        $response = $this->getJson('/api/v1/system/dr-probe', $headers);
        $this->assertNotNull($response->json('dr.lastBackupAt'));
        $this->assertNotNull($response->json('dr.lastBackupName'));
    }

    public function test_dr_probe_reports_restore_test_result_after_restore(): void
    {
        $headers = $this->adminHeaders();

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)->json('backup.name');
        $this->postJson('/api/v1/system/backups/restore', ['name' => $name], $headers)->assertOk();

        $this->getJson('/api/v1/system/dr-probe', $headers)
            ->assertOk()
            ->assertJsonPath('dr.lastRestoreTestOk', true);
    }

    public function test_non_admins_cannot_access_status_or_dr_probe(): void
    {
        $headers = $this->viewerHeaders();

        $this->getJson('/api/v1/system/status', $headers)->assertForbidden();
        $this->getJson('/api/v1/system/dr-probe', $headers)->assertForbidden();
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/system/status')->assertUnauthorized();
        $this->getJson('/api/v1/system/dr-probe')->assertUnauthorized();
    }

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'status-admin@example.test',
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
            'email' => 'status-viewer@example.test',
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
