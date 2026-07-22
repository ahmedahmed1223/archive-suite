<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\BulkMacro;
use App\Services\BulkMacros\BulkMacroService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class BulkMacrosApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_editor_can_create_update_and_delete_an_ordered_macro(): void
    {
        $created = $this->postJson('/api/v1/bulk-macros', [
            'name' => 'وسم ثم اعتماد',
            'steps' => [
                ['type' => 'add-tag', 'tag' => 'featured'],
                ['type' => 'set-workflow-status', 'status' => 'approved'],
            ],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('macro.version', 1)
            ->assertJsonPath('macro.steps.0.type', 'add-tag')
            ->assertJsonPath('macro.steps.1.type', 'set-workflow-status');

        $id = $created->json('macro.id');
        $this->assertIsString($id);

        $this->patchJson("/api/v1/bulk-macros/{$id}", [
            'name' => 'اعتماد ثم وسم',
            'steps' => [
                ['type' => 'set-workflow-status', 'status' => 'review'],
                ['type' => 'add-tag', 'tag' => 'reviewed'],
            ],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('macro.version', 2)
            ->assertJsonPath('macro.steps.0.type', 'set-workflow-status');

        $this->postJson('/api/v1/bulk-macros', [
            'name' => 'invalid',
            'steps' => [['type' => 'add-tag', 'tag' => '']],
        ], $this->authHeaders())->assertUnprocessable();

        $this->deleteJson("/api/v1/bulk-macros/{$id}", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);
    }

    public function test_viewers_and_other_owners_cannot_manage_a_macro(): void
    {
        $id = $this->createMacro($this->authHeaders());
        $viewer = $this->headersFor('viewer@example.test', 'viewer');
        $otherEditor = $this->headersFor('other@example.test', 'editor');

        $this->getJson('/api/v1/bulk-macros', $viewer)->assertForbidden();
        $this->postJson('/api/v1/bulk-macros', ['name' => 'x', 'steps' => [['type' => 'delete']]], $viewer)->assertForbidden();
        $this->getJson("/api/v1/bulk-macros/{$id}", $otherEditor)->assertNotFound();
        $this->patchJson("/api/v1/bulk-macros/{$id}", ['name' => 'hijack'], $otherEditor)->assertNotFound();
        $this->deleteJson("/api/v1/bulk-macros/{$id}", [], $otherEditor)->assertNotFound();
    }

    public function test_preview_is_non_mutating_and_run_requires_the_exact_fresh_confirmation(): void
    {
        $this->seedRecord('macro-1');
        $id = $this->createMacro($this->authHeaders(), [
            ['type' => 'add-tag', 'tag' => 'featured'],
            ['type' => 'set-workflow-status', 'status' => 'approved'],
            ['type' => 'delete'],
        ]);
        $targets = [
            ['store' => 'archive-items', 'id' => 'macro-1'],
            ['store' => 'archive-items', 'id' => 'missing'],
        ];

        $preview = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('summary.targetCount', 2)
            ->assertJsonPath('results.0.steps.0.type', 'add-tag')
            ->assertJsonPath('results.0.steps.2.type', 'delete')
            ->assertJsonPath('results.1.status', 'missing');

        $this->getJson('/api/v1/records/macro-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.workflowStatus', 'draft')
            ->assertJsonPath('record.tags.0', 'existing');
        $this->assertDatabaseCount('trashed_records', 0);

        $token = $preview->json('previewToken');
        $this->assertIsString($token);
        $this->postJson("/api/v1/bulk-macros/{$id}/run", [
            'targets' => array_reverse($targets),
            'previewToken' => $token,
        ], $this->authHeaders())->assertStatus(422)->assertJsonPath('code', 'invalid_preview');

        $other = User::query()->create(['name' => 'second', 'email' => 'second-editor@example.test', 'password' => Hash::make('secret-password'), 'role' => 'editor']);
        $this->assertSame('invalid_preview', app(BulkMacroService::class)->validateConfirmation($token, BulkMacro::query()->findOrFail($id), $other, $targets));

        $this->travel(16)->minutes();
        $refreshedToken = $this->postJson('/api/v1/auth/login', ['email' => 'admin@example.test', 'password' => 'secret-password'])->assertOk()->json('accessToken');
        $this->postJson("/api/v1/bulk-macros/{$id}/run", [
            'targets' => $targets,
            'previewToken' => $token,
        ], ['Authorization' => 'Bearer '.$refreshedToken])->assertStatus(422)->assertJsonPath('code', 'expired_preview');
        $this->travelBack();

        $freshToken = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())->assertOk()->json('previewToken');
        $this->patchJson("/api/v1/bulk-macros/{$id}", ['name' => 'changed after preview'], $this->authHeaders())->assertOk();
        $this->postJson("/api/v1/bulk-macros/{$id}/run", ['targets' => $targets, 'previewToken' => $freshToken], $this->authHeaders())
            ->assertStatus(422)->assertJsonPath('code', 'stale_preview');
    }

    public function test_run_persists_partial_results_and_uses_recoverable_trash(): void
    {
        $this->seedRecord('macro-1');
        $id = $this->createMacro($this->authHeaders(), [
            ['type' => 'add-tag', 'tag' => 'featured'],
            ['type' => 'set-workflow-status', 'status' => 'approved'],
            ['type' => 'delete'],
        ]);
        $targets = [
            ['store' => 'archive-items', 'id' => 'macro-1'],
            ['store' => 'archive-items', 'id' => 'missing'],
        ];
        $token = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())
            ->assertOk()->json('previewToken');

        $run = $this->postJson("/api/v1/bulk-macros/{$id}/run", [
            'targets' => $targets,
            'previewToken' => $token,
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.targetCount', 2)
            ->assertJsonPath('run.completedCount', 1)
            ->assertJsonPath('run.results.0.steps.0.status', 'completed')
            ->assertJsonPath('run.results.1.status', 'missing');

        $this->getJson('/api/v1/records/macro-1?store=archive-items', $this->authHeaders())->assertNotFound();
        $this->assertDatabaseHas('trashed_records', ['store' => 'archive-items', 'uid' => 'macro-1']);
        $this->getJson("/api/v1/bulk-macros/{$id}/runs", $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'runs')
            ->assertJsonPath('runs.0.id', $run->json('run.id'));
    }

    /** @param array<int, array<string, string>> $steps */
    private function createMacro(array $headers, array $steps = [['type' => 'delete']]): string
    {
        $id = $this->postJson('/api/v1/bulk-macros', ['name' => 'macro', 'steps' => $steps], $headers)
            ->assertCreated()->json('macro.id');
        $this->assertIsString($id);

        return $id;
    }

    private function seedRecord(string $id): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => $id, 'id' => $id, 'title' => 'Macro target', 'tags' => ['existing'], 'workflowStatus' => 'draft',
        ]]], $this->authHeaders())->assertOk();
    }

    /** @return array<string, string> */
    private function headersFor(string $email, string $role): array
    {
        User::query()->create(['name' => $role, 'email' => $email, 'password' => Hash::make('secret-password'), 'role' => $role]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'secret-password'])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
