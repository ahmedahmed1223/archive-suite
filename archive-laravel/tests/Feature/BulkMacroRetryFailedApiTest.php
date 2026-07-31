<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class BulkMacroRetryFailedApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_retry_reruns_only_the_partial_target_and_links_it_to_the_original_run(): void
    {
        $this->seedRecord('macro-retry-target');
        $id = $this->createMacro(['type' => 'set-workflow-status', 'status' => 'approved']);
        $targets = [['store' => 'archive-items', 'id' => 'macro-retry-target']];
        $token = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())
            ->assertOk()->json('previewToken');

        // Simulate a transient failure: the mutation affects zero rows.
        DB::statement("CREATE TRIGGER retry_zero_row BEFORE UPDATE OF data ON storage_rows WHEN NEW.data LIKE '%approved%' BEGIN DELETE FROM storage_rows WHERE store = OLD.store AND uid = OLD.uid; SELECT RAISE(IGNORE); END");

        $run = $this->postJson("/api/v1/bulk-macros/{$id}/run", ['targets' => $targets, 'previewToken' => $token], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.results.0.status', 'partial');
        $runId = $run->json('run.id');

        // The transient condition is resolved: drop the trigger and restore the record.
        DB::statement('DROP TRIGGER retry_zero_row');
        $this->seedRecord('macro-retry-target');

        $retry = $this->postJson("/api/v1/bulk-macros/{$id}/runs/{$runId}/retry-failed", [], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('run.retriedFromRunId', $runId)
            ->assertJsonPath('run.targetCount', 1)
            ->assertJsonPath('run.completedCount', 1)
            ->assertJsonPath('run.results.0.status', 'completed');

        $this->assertNotSame($runId, $retry->json('run.id'));
    }

    public function test_retry_on_an_unknown_run_returns_not_found(): void
    {
        $id = $this->createMacro(['type' => 'delete']);
        $this->postJson("/api/v1/bulk-macros/{$id}/runs/00000000-0000-0000-0000-000000000000/retry-failed", [], $this->authHeaders())
            ->assertStatus(404);
    }

    private function createMacro(array $step): string
    {
        $id = $this->postJson('/api/v1/bulk-macros', ['name' => 'macro', 'steps' => [$step]], $this->authHeaders())
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
}
