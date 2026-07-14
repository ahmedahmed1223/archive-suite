<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
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

    // -- tag nodes (V1-102F gap: write ops were open to every authenticated role) --

    public function test_viewer_cannot_create_a_tag_node(): void
    {
        $this->postJson('/api/v1/tag-nodes', [
            'tag' => 'viewer-attempt',
            'parent' => '',
        ], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_viewer_cannot_update_a_tag_node(): void
    {
        $id = $this->createTagNodeAsEditor('viewer-update-target');

        $this->patchJson("/api/v1/tag-nodes/{$id}", [
            'tag' => 'hijacked',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_delete_a_tag_node(): void
    {
        $id = $this->createTagNodeAsEditor('viewer-delete-target');

        $this->deleteJson("/api/v1/tag-nodes/{$id}", [], $this->viewerHeaders())
            ->assertForbidden();
    }

    public function test_viewer_cannot_reorder_tag_nodes(): void
    {
        $id = $this->createTagNodeAsEditor('viewer-reorder-target');

        $this->postJson('/api/v1/tag-nodes/reorder', [
            'order' => [['id' => $id, 'order_index' => 5]],
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_merge_tag_nodes(): void
    {
        $sourceId = $this->createTagNodeAsEditor('viewer-merge-source');
        $targetId = $this->createTagNodeAsEditor('viewer-merge-target');

        $this->postJson("/api/v1/tag-nodes/{$sourceId}/merge", [
            'mergeInto' => $targetId,
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_move_a_tag_node(): void
    {
        $id = $this->createTagNodeAsEditor('viewer-move-target');

        $this->postJson("/api/v1/tag-nodes/{$id}/move", [
            'parent' => '',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_editor_can_create_update_reorder_merge_move_and_delete_a_tag_node(): void
    {
        $editorHeaders = $this->editorHeaders();

        $id = $this->postJson('/api/v1/tag-nodes', [
            'tag' => 'editor-tag',
            'parent' => '',
        ], $editorHeaders)->assertCreated()->json('node.id');

        $siblingId = $this->postJson('/api/v1/tag-nodes', [
            'tag' => 'editor-sibling',
            'parent' => '',
        ], $editorHeaders)->assertCreated()->json('node.id');

        $this->patchJson("/api/v1/tag-nodes/{$id}", [
            'tag' => 'editor-tag-renamed',
        ], $editorHeaders)->assertOk()->assertJsonPath('node.tag', 'editor-tag-renamed');

        $this->postJson('/api/v1/tag-nodes/reorder', [
            'order' => [['id' => $id, 'order_index' => 1]],
        ], $editorHeaders)->assertOk()->assertJsonPath('ok', true);

        $this->postJson("/api/v1/tag-nodes/{$siblingId}/merge", [
            'mergeInto' => $id,
        ], $editorHeaders)->assertOk()->assertJsonPath('merged', true);

        $this->postJson("/api/v1/tag-nodes/{$id}/move", [
            'parent' => '',
        ], $editorHeaders)->assertOk()->assertJsonPath('moved', true);

        $this->deleteJson("/api/v1/tag-nodes/{$id}", [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- vocabulary (V1-102F gap: write ops were open to every authenticated role) --

    public function test_viewer_cannot_create_a_vocabulary_term(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'viewer-term',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_delete_a_vocabulary_term(): void
    {
        $id = $this->postJson('/api/v1/vocabulary', [
            'term' => 'editor-term',
        ], $this->editorHeaders())->json('term.id');

        $this->deleteJson("/api/v1/vocabulary/{$id}", [], $this->viewerHeaders())
            ->assertForbidden();
    }

    public function test_editor_can_create_and_delete_a_vocabulary_term(): void
    {
        $editorHeaders = $this->editorHeaders();

        $id = $this->postJson('/api/v1/vocabulary', [
            'term' => 'editor-only-term',
        ], $editorHeaders)->assertCreated()->json('term.id');

        $this->deleteJson("/api/v1/vocabulary/{$id}", [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- collections (V1-102F gap: write ops were open to every authenticated role) --

    public function test_viewer_cannot_create_a_collection(): void
    {
        $this->postJson('/api/v1/collections', [
            'name' => 'viewer-collection',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_delete_a_collection(): void
    {
        $id = $this->postJson('/api/v1/collections', [
            'name' => 'editor-collection',
        ], $this->editorHeaders())->json('collection.id');

        $this->deleteJson("/api/v1/collections/{$id}", [], $this->viewerHeaders())
            ->assertForbidden();
    }

    public function test_editor_can_create_and_delete_a_collection(): void
    {
        $editorHeaders = $this->editorHeaders();

        $id = $this->postJson('/api/v1/collections', [
            'name' => 'editor-only-collection',
        ], $editorHeaders)->assertCreated()->json('collection.id');

        $this->deleteJson("/api/v1/collections/{$id}", [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- relations (V1-102F gap: write ops were open to every authenticated role) --

    public function test_viewer_cannot_create_a_relation(): void
    {
        $this->seedRelationRecords('rel-a', 'rel-b');

        $this->postJson('/api/v1/relations', [
            'sourceId' => 'rel-a',
            'targetId' => 'rel-b',
            'type' => 'related_to',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_update_or_delete_a_relation(): void
    {
        $this->seedRelationRecords('rel-c', 'rel-d');
        $relationId = $this->postJson('/api/v1/relations', [
            'sourceId' => 'rel-c',
            'targetId' => 'rel-d',
            'type' => 'related_to',
        ], $this->editorHeaders())->json('relation.id');

        $viewerHeaders = $this->viewerHeaders();

        $this->patchJson("/api/v1/relations/{$relationId}", [
            'note' => 'hijacked',
        ], $viewerHeaders)->assertForbidden();

        $this->deleteJson("/api/v1/relations/{$relationId}", [], $viewerHeaders)
            ->assertForbidden();
    }

    public function test_editor_can_create_update_and_delete_a_relation(): void
    {
        $this->seedRelationRecords('rel-e', 'rel-f');
        $editorHeaders = $this->editorHeaders();

        $relationId = $this->postJson('/api/v1/relations', [
            'sourceId' => 'rel-e',
            'targetId' => 'rel-f',
            'type' => 'related_to',
        ], $editorHeaders)->assertCreated()->json('relation.id');

        $this->patchJson("/api/v1/relations/{$relationId}", [
            'note' => 'updated note',
        ], $editorHeaders)->assertOk()->assertJsonPath('relation.note', 'updated note');

        $this->deleteJson("/api/v1/relations/{$relationId}", [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- types (V1-102F gap: write ops were open to every authenticated role; --
    // -- check-field-acl stays open to every role — it is a read-only permission --
    // -- lookup, not a write, and viewers/editors need it to know what they may edit) --

    public function test_viewer_cannot_create_a_type(): void
    {
        $this->postJson('/api/v1/types', [
            'id' => 'viewer-type',
            'name' => 'Viewer Type',
            'fields' => [['name' => 'title', 'type' => 'text']],
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_delete_a_type(): void
    {
        $this->postJson('/api/v1/types', [
            'id' => 'editor-type',
            'name' => 'Editor Type',
            'fields' => [['name' => 'title', 'type' => 'text']],
        ], $this->editorHeaders())->assertCreated();

        $this->deleteJson('/api/v1/types/editor-type', [], $this->viewerHeaders())
            ->assertForbidden();
    }

    public function test_editor_can_create_and_delete_a_type(): void
    {
        $editorHeaders = $this->editorHeaders();

        $this->postJson('/api/v1/types', [
            'id' => 'editor-only-type',
            'name' => 'Editor Only Type',
            'fields' => [['name' => 'title', 'type' => 'text']],
        ], $editorHeaders)->assertCreated();

        $this->deleteJson('/api/v1/types/editor-only-type', [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- automation rules (V1-102F gap: write ops were open to every authenticated role) --

    public function test_viewer_cannot_create_an_automation_rule(): void
    {
        $this->postJson('/api/v1/automation/rules', [
            'name' => 'viewer-rule',
            'trigger' => 'record.created',
            'action' => 'add-tag',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_update_delete_or_run_an_automation_rule(): void
    {
        $ruleId = $this->postJson('/api/v1/automation/rules', [
            'name' => 'editor-rule',
            'trigger' => 'record.created',
            'action' => 'add-tag',
        ], $this->editorHeaders())->json('rule.id');

        $viewerHeaders = $this->viewerHeaders();

        $this->patchJson("/api/v1/automation/rules/{$ruleId}", [
            'name' => 'hijacked',
        ], $viewerHeaders)->assertForbidden();

        $this->postJson("/api/v1/automation/rules/{$ruleId}/run", [
            'dryRun' => true,
        ], $viewerHeaders)->assertForbidden();

        $this->deleteJson("/api/v1/automation/rules/{$ruleId}", [], $viewerHeaders)
            ->assertForbidden();
    }

    public function test_editor_can_create_update_run_and_delete_an_automation_rule(): void
    {
        $editorHeaders = $this->editorHeaders();

        $ruleId = $this->postJson('/api/v1/automation/rules', [
            'name' => 'editor-only-rule',
            'trigger' => 'record.created',
            'action' => 'add-tag',
        ], $editorHeaders)->assertCreated()->json('rule.id');

        $this->patchJson("/api/v1/automation/rules/{$ruleId}", [
            'name' => 'editor-only-rule-renamed',
        ], $editorHeaders)->assertOk()->assertJsonPath('rule.name', 'editor-only-rule-renamed');

        $this->postJson("/api/v1/automation/rules/{$ruleId}/run", [
            'dryRun' => true,
        ], $editorHeaders)->assertCreated()->assertJsonPath('ok', true);

        $this->deleteJson("/api/v1/automation/rules/{$ruleId}", [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- ingest (V1-102F gap: write ops were open to every authenticated role) --

    public function test_viewer_cannot_trigger_an_ingest_scan(): void
    {
        $this->postJson('/api/v1/ingest/scan', [], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_viewer_cannot_trigger_an_ftp_pull(): void
    {
        $this->postJson('/api/v1/ingest/ftp/pull', [
            'host' => '192.168.1.100',
            'user' => 'viewer',
            'password' => 'pass',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_trigger_an_smb_pull(): void
    {
        $this->postJson('/api/v1/ingest/smb/pull', [
            'share' => '\\\\server\\share',
            'user' => 'viewer',
            'password' => 'pass',
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_editor_can_trigger_an_ingest_scan(): void
    {
        Storage::fake(config('ingest.disk'));

        $this->postJson('/api/v1/ingest/scan', [], $this->editorHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    // -- upload links (V1-102F gap: write ops were open to every authenticated role) --

    public function test_viewer_cannot_create_an_upload_link(): void
    {
        $this->postJson('/api/v1/upload-links', [
            'expiresInHours' => 24,
        ], $this->viewerHeaders())->assertForbidden();
    }

    public function test_viewer_cannot_revoke_an_upload_link(): void
    {
        $id = $this->postJson('/api/v1/upload-links', [
            'expiresInHours' => 24,
        ], $this->editorHeaders())->json('link.id');

        $this->postJson("/api/v1/upload-links/{$id}/revoke", [], $this->viewerHeaders())
            ->assertForbidden();
    }

    public function test_editor_can_create_and_revoke_an_upload_link(): void
    {
        $editorHeaders = $this->editorHeaders();

        $id = $this->postJson('/api/v1/upload-links', [
            'expiresInHours' => 24,
        ], $editorHeaders)->assertCreated()->json('link.id');

        $this->postJson("/api/v1/upload-links/{$id}/revoke", [], $editorHeaders)
            ->assertOk()
            ->assertJsonPath('link.revoked', true);
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

    private function createTagNodeAsEditor(string $tag): string
    {
        return $this->postJson('/api/v1/tag-nodes', [
            'tag' => $tag,
            'parent' => '',
        ], $this->editorHeaders())->json('node.id');
    }

    private function seedRelationRecords(string ...$ids): void
    {
        $now = now();

        foreach ($ids as $id) {
            DB::table('storage_rows')->insert([
                'store' => 'archive-items',
                'uid' => $id,
                'data' => json_encode(['uid' => $id, 'id' => $id, 'title' => $id], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
