<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class BulkMacroRollbackApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_rollback_restores_tag_and_workflow_status_fields_from_captured_before_values(): void
    {
        $this->seedRecord('rollback-fields');
        $id = $this->createMacro([
            ['type' => 'add-tag', 'tag' => 'featured'],
            ['type' => 'set-workflow-status', 'status' => 'approved'],
        ]);
        $targets = [['store' => 'archive-items', 'id' => 'rollback-fields']];
        $token = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())->json('previewToken');
        $run = $this->postJson("/api/v1/bulk-macros/{$id}/run", ['targets' => $targets, 'previewToken' => $token], $this->authHeaders())
            ->assertCreated();
        $runId = $run->json('run.id');

        $this->getJson('/api/v1/records/rollback-fields?store=archive-items', $this->authHeaders())
            ->assertJsonPath('record.workflowStatus', 'approved')
            ->assertJsonPath('record.tags', ['existing', 'featured']);

        $rollback = $this->postJson("/api/v1/bulk-macros/{$id}/runs/{$runId}/rollback", [], $this->authHeaders())
            ->assertOk();
        $this->assertSame('rolled_back', $rollback->json('rollback.0.status'));
        $this->assertSame('rolled_back', $rollback->json('rollback.0.steps.0.status'));

        $this->getJson('/api/v1/records/rollback-fields?store=archive-items', $this->authHeaders())
            ->assertJsonPath('record.workflowStatus', 'draft')
            ->assertJsonPath('record.tags', ['existing']);
    }

    public function test_rollback_of_a_delete_step_restores_from_trash(): void
    {
        $this->seedRecord('rollback-delete');
        $id = $this->createMacro([['type' => 'delete']]);
        $targets = [['store' => 'archive-items', 'id' => 'rollback-delete']];
        $token = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())->json('previewToken');
        $run = $this->postJson("/api/v1/bulk-macros/{$id}/run", ['targets' => $targets, 'previewToken' => $token], $this->authHeaders())
            ->assertCreated();
        $runId = $run->json('run.id');

        $this->getJson('/api/v1/records/rollback-delete?store=archive-items', $this->authHeaders())->assertNotFound();

        $rollback = $this->postJson("/api/v1/bulk-macros/{$id}/runs/{$runId}/rollback", [], $this->authHeaders())->assertOk();
        $this->assertSame('rolled_back', $rollback->json('rollback.0.status'));

        $this->getJson('/api/v1/records/rollback-delete?store=archive-items', $this->authHeaders())->assertOk();
    }

    public function test_rollback_of_a_rights_holder_step_is_honestly_reported_as_not_capable(): void
    {
        $this->seedRecord('rollback-rights');
        $id = $this->createMacro([['type' => 'set-rights-holder', 'rightsHolder' => 'Studio A']]);
        $targets = [['store' => 'archive-items', 'id' => 'rollback-rights']];
        $token = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())->json('previewToken');
        $run = $this->postJson("/api/v1/bulk-macros/{$id}/run", ['targets' => $targets, 'previewToken' => $token], $this->authHeaders())
            ->assertCreated();
        $runId = $run->json('run.id');

        $rollback = $this->postJson("/api/v1/bulk-macros/{$id}/runs/{$runId}/rollback", [], $this->authHeaders())->assertOk();
        $this->assertSame('not_rollback_capable', $rollback->json('rollback.0.status'));
        $this->assertSame('not_rollback_capable', $rollback->json('rollback.0.steps.0.status'));
        $this->assertSame('no_before_state_captured', $rollback->json('rollback.0.steps.0.reason'));
    }

    public function test_rollback_requires_editor_and_a_real_run(): void
    {
        $id = $this->createMacro([['type' => 'delete']]);
        $viewer = $this->viewerHeaders();

        $this->postJson("/api/v1/bulk-macros/{$id}/runs/does-not-exist/rollback", [], $viewer)->assertForbidden();
        $this->postJson("/api/v1/bulk-macros/{$id}/runs/does-not-exist/rollback", [], $this->authHeaders())->assertNotFound();
    }

    /** @param array<int, array<string, string>> $steps */
    private function createMacro(array $steps): string
    {
        $id = $this->postJson('/api/v1/bulk-macros', ['name' => 'macro', 'steps' => $steps], $this->authHeaders())
            ->assertCreated()->json('macro.id');
        $this->assertIsString($id);

        return $id;
    }

    private function seedRecord(string $id): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => $id, 'id' => $id, 'title' => 'Rollback target', 'tags' => ['existing'], 'workflowStatus' => 'draft',
        ]]], $this->authHeaders())->assertOk();
    }

    /** @return array<string, string> */
    private function viewerHeaders(): array
    {
        $email = 'rollback-viewer@example.test';
        User::query()->create(['name' => 'viewer', 'email' => $email, 'password' => Hash::make('secret-password'), 'role' => 'viewer']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'secret-password'])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
