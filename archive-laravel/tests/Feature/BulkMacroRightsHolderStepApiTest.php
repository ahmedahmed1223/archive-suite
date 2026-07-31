<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class BulkMacroRightsHolderStepApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_sets_the_rights_holder_for_each_target(): void
    {
        $this->seedRecord('macro-rights-target');
        $id = $this->postJson('/api/v1/bulk-macros', [
            'name' => 'macro',
            'steps' => [['type' => 'set-rights-holder', 'rightsHolder' => 'القناة الرسمية']],
        ], $this->authHeaders())->assertCreated()->json('macro.id');

        $targets = [['store' => 'archive-items', 'id' => 'macro-rights-target']];
        $token = $this->postJson("/api/v1/bulk-macros/{$id}/preview", ['targets' => $targets], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('results.0.steps.0.status', 'would_apply')
            ->assertJsonPath('results.0.steps.0.after', 'القناة الرسمية')
            ->json('previewToken');

        $this->postJson("/api/v1/bulk-macros/{$id}/run", ['targets' => $targets, 'previewToken' => $token], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.results.0.status', 'completed')
            ->assertJsonPath('run.results.0.steps.0.status', 'completed');

        $this->getJson('/api/v1/rights?itemId=macro-rights-target', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.rightsHolder', 'القناة الرسمية');
    }

    public function test_it_rejects_a_step_with_an_empty_rights_holder(): void
    {
        $this->postJson('/api/v1/bulk-macros', [
            'name' => 'macro',
            'steps' => [['type' => 'set-rights-holder', 'rightsHolder' => '']],
        ], $this->authHeaders())->assertStatus(422);
    }

    private function seedRecord(string $id): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => $id, 'id' => $id, 'title' => 'Macro target', 'workflowStatus' => 'draft',
        ]]], $this->authHeaders())->assertOk();
    }
}
