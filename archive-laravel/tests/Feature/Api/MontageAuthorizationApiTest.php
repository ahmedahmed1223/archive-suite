<?php

namespace Tests\Feature\Api;

use App\Models\MontageExport;
use App\Models\MontageProject;
use App\Models\User;
use App\Support\ApiToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class MontageAuthorizationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_bearer_actor_owns_new_project_and_can_save_revision(): void
    {
        $editor = $this->user('editor');
        $headers = $this->headersFor($editor);

        $created = $this->postJson('/api/v1/montage-projects', ['name' => 'Owned montage'], $headers)
            ->assertCreated()
            ->assertJsonPath('project.ownerId', (string) $editor->id);

        $projectId = $created->json('project.id');

        $this->postJson("/api/v1/montage-projects/{$projectId}/revision", $this->revisionPayload(), $headers)
            ->assertCreated()
            ->assertJsonPath('createdBy', (string) $editor->id)
            ->assertJsonPath('revisionNumber', 1);

        $this->assertDatabaseHas('montage_projects', ['id' => $projectId, 'owner_id' => $editor->id]);
        $this->assertDatabaseHas('montage_project_revisions', ['montage_project_id' => $projectId, 'created_by' => $editor->id]);
    }

    public function test_viewer_and_unrelated_editor_cannot_write_owned_project(): void
    {
        $owner = $this->user('editor');
        $viewer = $this->user('viewer');
        $otherEditor = $this->user('editor');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);

        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $this->headersFor($viewer))
            ->assertForbidden();
        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $this->headersFor($otherEditor))
            ->assertForbidden();
        $this->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ], $this->headersFor($otherEditor))->assertForbidden();
    }

    public function test_inaccessible_revision_and_export_reads_are_safe_not_found(): void
    {
        $owner = $this->user('editor');
        $other = $this->user('viewer');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $ownerHeaders = $this->headersFor($owner);

        $revision = $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $ownerHeaders)
            ->assertCreated();
        $export = $this->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ], $ownerHeaders)->assertCreated();

        $otherHeaders = $this->headersFor($other);
        $this->getJson("/api/v1/montage-projects/{$project->id}/revisions", $otherHeaders)->assertNotFound();
        $this->getJson("/api/v1/montage-projects/{$project->id}/exports/{$export->json('id')}", $otherHeaders)->assertNotFound();
        $this->assertNotNull($revision->json('id'));
    }

    public function test_viewer_api_key_does_not_inherit_admin_owners_write_access(): void
    {
        $admin = $this->user('admin');
        $project = MontageProject::factory()->create(['owner_id' => $admin->id]);
        $token = 'archive-key-'.Str::random(48);
        DB::table('api_keys')->insert([
            'id' => (string) Str::uuid(),
            'name' => 'Read-only integration',
            'role' => 'viewer',
            'token_hash' => ApiToken::hash($token),
            'user_id' => $admin->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $headers = ['Authorization' => 'Bearer '.$token];

        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $headers)
            ->assertForbidden();
        $this->deleteJson("/api/v1/montage-projects/{$project->id}", [], $headers)
            ->assertForbidden();
    }

    public function test_legacy_unowned_project_remains_readable_and_editable_by_role(): void
    {
        $legacy = MontageProject::factory()->create(['owner_id' => null]);
        $viewer = $this->user('viewer');
        $editor = $this->user('editor');

        $this->getJson("/api/v1/montage-projects/{$legacy->id}", $this->headersFor($viewer))
            ->assertOk()
            ->assertJsonPath('project.ownerId', null);
        $this->postJson("/api/v1/montage-projects/{$legacy->id}/revision", $this->revisionPayload(), $this->headersFor($editor))
            ->assertCreated();
    }

    public function test_restore_creates_a_new_immutable_revision_from_history(): void
    {
        $owner = $this->user('editor');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $headers = $this->headersFor($owner);

        $first = $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload([
            ['id' => 'track-original', 'kind' => 'video'],
        ]), $headers)->assertCreated();
        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload([
            ['id' => 'track-newer', 'kind' => 'video'],
        ], 1), $headers)->assertCreated();

        $this->postJson(
            "/api/v1/montage-projects/{$project->id}/revisions/{$first->json('id')}/restore",
            ['expectedRevision' => 2],
            $headers,
        )->assertCreated()
            ->assertJsonPath('revisionNumber', 3)
            ->assertJsonPath('tracks.0.id', 'track-original');

        $this->assertDatabaseHas('montage_project_revisions', [
            'id' => $first->json('id'),
            'revision_number' => 1,
        ]);
        $this->assertSame(3, (int) $project->fresh()->revision);
    }

    public function test_owner_editor_can_delete_owned_project_but_viewer_cannot(): void
    {
        $owner = $this->user('editor');
        $viewer = $this->user('viewer');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);

        $this->deleteJson("/api/v1/montage-projects/{$project->id}", [], $this->headersFor($owner))
            ->assertOk();
        // A fresh project owned by the editor; a viewer must be refused.
        $other = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $this->deleteJson("/api/v1/montage-projects/{$other->id}", [], $this->headersFor($viewer))
            ->assertForbidden();
    }

    public function test_revision_conflict_uses_documented_error_shape(): void
    {
        $owner = $this->user('editor');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $headers = $this->headersFor($owner);

        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $headers)
            ->assertCreated();

        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload([], 0), $headers)
            ->assertConflict()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'CONFLICT')
            ->assertJsonPath('currentRevision', 1)
            ->assertJsonPath('expectedRevision', 0);
    }

    public function test_revision_validation_uses_documented_error_shape(): void
    {
        $owner = $this->user('editor');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $headers = $this->headersFor($owner);
        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $headers)
            ->assertCreated();

        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", [
            'expectedRevision' => 1,
            'tracks' => [],
            'clips' => [['id' => 'invalid-clip']],
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['errors' => ['clips.0.trackId']]);
    }

    public function test_export_validation_uses_documented_error_shape(): void
    {
        $owner = $this->user('editor');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $headers = $this->headersFor($owner);
        $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $headers)
            ->assertCreated();

        $this->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'client-codec',
        ], $headers)
            ->assertUnprocessable()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['errors' => ['preset']]);
    }

    public function test_export_state_failure_uses_documented_error_shape(): void
    {
        $owner = $this->user('editor');
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $headers = $this->headersFor($owner);
        $revision = $this->postJson("/api/v1/montage-projects/{$project->id}/revision", $this->revisionPayload(), $headers)
            ->assertCreated();

        $completed = MontageExport::query()->create([
            'montage_project_id' => $project->id,
            'montage_project_revision_id' => $revision->json('id'),
            'requested_by' => $owner->id,
            'preset' => 'web-1080p',
            'status' => 'completed',
            'progress' => 100,
            'settings' => [],
        ]);
        $this->postJson("/api/v1/montage-projects/{$project->id}/exports/{$completed->id}/cancel", [], $headers)
            ->assertUnprocessable()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonPath('status', 'completed');
    }

    public function test_requester_owner_and_admin_may_cancel_or_retry_but_unrelated_editor_may_not(): void
    {
        $owner = $this->user('editor');
        $requester = $this->user('editor');
        $other = $this->user('editor');
        $admin = $this->user('admin');
        $legacy = MontageProject::factory()->create(['owner_id' => null]);
        $requesterHeaders = $this->headersFor($requester);
        $revision = $this->postJson("/api/v1/montage-projects/{$legacy->id}/revision", $this->revisionPayload(), $requesterHeaders)
            ->assertCreated();

        $cancelled = $this->postJson("/api/v1/montage-projects/{$legacy->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ], $requesterHeaders)->assertCreated();
        $this->postJson("/api/v1/montage-projects/{$legacy->id}/exports/{$cancelled->json('id')}/cancel", [], $this->headersFor($other))
            ->assertForbidden();
        $this->postJson("/api/v1/montage-projects/{$legacy->id}/exports/{$cancelled->json('id')}/cancel", [], $requesterHeaders)
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $owned = MontageProject::factory()->create(['owner_id' => $owner->id, 'revision' => 1, 'active_revision_id' => $revision->json('id')]);
        $failed = MontageExport::query()->create([
            'montage_project_id' => $owned->id,
            'montage_project_revision_id' => $revision->json('id'),
            'requested_by' => $requester->id,
            'preset' => 'web-1080p',
            'status' => 'failed',
            'progress' => 25,
            'settings' => [],
        ]);

        $this->postJson("/api/v1/montage-projects/{$owned->id}/exports/{$failed->id}/retry", [], $this->headersFor($other))
            ->assertForbidden();
        $this->postJson("/api/v1/montage-projects/{$owned->id}/exports/{$failed->id}/retry", [], $this->headersFor($owner))
            ->assertCreated();

        $adminExport = MontageExport::query()->create([
            'montage_project_id' => $owned->id,
            'montage_project_revision_id' => $revision->json('id'),
            'requested_by' => $requester->id,
            'preset' => 'web-4k',
            'status' => 'failed',
            'progress' => 25,
            'settings' => [],
        ]);
        $this->postJson("/api/v1/montage-projects/{$owned->id}/exports/{$adminExport->id}/retry", [], $this->headersFor($admin))
            ->assertCreated();
    }

    /**
     * @param  array<int, array<string, mixed>>  $tracks
     * @return array<string, mixed>
     */
    private function revisionPayload(array $tracks = [], int $expectedRevision = 0): array
    {
        return [
            'expectedRevision' => $expectedRevision,
            'tracks' => $tracks,
            'clips' => [],
        ];
    }

    private function user(string $role): User
    {
        return User::factory()->create([
            'role' => $role,
            'password' => Hash::make('secret-password'),
        ]);
    }

    /** @return array<string, string> */
    private function headersFor(User $user): array
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }
}
