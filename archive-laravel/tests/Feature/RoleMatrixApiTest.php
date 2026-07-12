<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * V1-102: RBAC matrix — asserts, per protected endpoint group, that the
 * under-privileged role is rejected with 403 and the privileged role
 * succeeds. Roles are the existing `users.role` column (admin/editor/viewer,
 * see UsersController::ROLES) enforced via Controller::requireAdmin()/
 * requireEditor(), backed by the Gate abilities in AuthServiceProvider.
 *
 * Endpoints already covered elsewhere are not duplicated here:
 * - admin-only surfaces (backups, system control, users, compliance
 *   reports, plugin marketplace) already used requireAdmin() before this
 *   change; this file adds one representative case per group for the matrix.
 * - media job ownership (V1-111) is covered by MediaJobsContainmentTest;
 *   store is intentionally open to every authenticated role (any user may
 *   queue work against their own records), so this file only documents that.
 */
class RoleMatrixApiTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupDir = storage_path('framework/testing/role-matrix-'.uniqid());
        config(['archive.backup_path' => $this->backupDir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupDir);

        parent::tearDown();
    }

    // -- share management (V1-102 gap: was open to every authenticated role) --

    public function test_viewer_cannot_create_a_share_link(): void
    {
        $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
        ], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_editor_can_create_a_share_link(): void
    {
        $this->postJson('/api/v1/share', [
            'scope' => ['itemIds' => ['item-1']],
        ], $this->editorHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true);
    }

    // -- record bulk write/delete (V1-102 gap: was open to every authenticated role) --

    public function test_viewer_cannot_bulk_upsert_records(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'r-1', 'title' => 'One']],
        ], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_editor_can_bulk_upsert_records(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'r-1', 'title' => 'One']],
        ], $this->editorHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_viewer_cannot_bulk_delete_records(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'r-1', 'title' => 'One']],
        ], $this->editorHeaders())->assertOk();

        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'archive-items',
            'ids' => ['r-1'],
        ], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_editor_can_bulk_delete_records(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'r-1', 'title' => 'One']],
        ], $this->editorHeaders())->assertOk();

        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'archive-items',
            'ids' => ['r-1'],
        ], $this->editorHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('count', 1);
    }

    // -- montage projects (V1-102 gap: no ownership column, was open to every role) --

    public function test_viewer_cannot_create_a_montage_project(): void
    {
        $this->postJson('/api/v1/montage-projects', [
            'name' => 'Viewer attempt',
        ], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_editor_can_create_update_and_delete_a_montage_project(): void
    {
        $editorHeaders = $this->editorHeaders();

        $projectId = $this->postJson('/api/v1/montage-projects', [
            'name' => 'Editor project',
        ], $editorHeaders)
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->json('project.id');

        $this->putJson("/api/v1/montage-projects/{$projectId}", [
            'name' => 'Renamed',
        ], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('project.name', 'Renamed');

        $this->deleteJson("/api/v1/montage-projects/{$projectId}", [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_viewer_cannot_update_or_delete_a_montage_project(): void
    {
        $projectId = $this->postJson('/api/v1/montage-projects', [
            'name' => 'Editor project',
        ], $this->editorHeaders())->json('project.id');

        $viewerHeaders = $this->viewerHeaders();

        $this->putJson("/api/v1/montage-projects/{$projectId}", [
            'name' => 'Hijacked',
        ], $viewerHeaders)->assertForbidden();

        $this->deleteJson("/api/v1/montage-projects/{$projectId}", [], $viewerHeaders)
            ->assertForbidden();
    }

    // -- backup/restore (already admin-gated pre-V1-102; matrix regression case) --

    public function test_viewer_cannot_run_a_backup(): void
    {
        $this->postJson('/api/v1/system/backups/run', [], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_admin_can_run_a_backup(): void
    {
        $this->postJson('/api/v1/system/backups/run', [], $this->adminHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true);
    }

    // -- admin/system-control (already admin-gated pre-V1-102; matrix regression case) --

    public function test_viewer_cannot_run_a_system_control_action(): void
    {
        config(['archive.system_control_enabled' => true]);

        $this->postJson('/api/v1/system/control/clear-cache', [], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_admin_can_run_a_system_control_action(): void
    {
        config(['archive.system_control_enabled' => true]);

        $this->postJson('/api/v1/system/control/clear-cache', [], $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- media jobs (V1-111 ownership already enforced; store is intentionally
    //    role-agnostic — every authenticated user may queue work of their own) --

    public function test_viewer_can_create_and_read_their_own_media_job(): void
    {
        $headers = $this->viewerHeaders();

        $jobId = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'role-matrix-record-1',
            'operation' => 'thumbnail',
        ], $headers)
            ->assertStatus(202)
            ->assertJsonPath('ok', true)
            ->json('job.id');

        $this->getJson("/api/v1/media/jobs/{$jobId}", $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- role helpers ---------------------------------------------------------

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        return $this->headersFor('admin', 'role-matrix-admin@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function editorHeaders(): array
    {
        return $this->headersFor('editor', 'role-matrix-editor@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        return $this->headersFor('viewer', 'role-matrix-viewer@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function headersFor(string $role, string $email): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => ucfirst($role),
                'password' => Hash::make('secret-password'),
                'role' => $role,
            ],
        );

        return ['Authorization' => 'Bearer '.$this->tokenFor($user)];
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
