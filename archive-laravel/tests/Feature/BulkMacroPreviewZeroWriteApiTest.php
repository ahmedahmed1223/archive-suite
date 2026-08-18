<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V3-WORK-003 acceptance: "the preview must perform zero writes". Covers
 * both this task's exclusive-lock preview surfaces -- BulkMacroService's
 * impact preview and SafetyPreviewService's synthetic run -- with a direct
 * before/after comparison of every table either could plausibly touch,
 * rather than trusting the endpoint's own "non-mutating" claim.
 */
class BulkMacroPreviewZeroWriteApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_bulk_macro_preview_writes_nothing_even_when_it_would_delete_and_mutate(): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => 'zero-write-target', 'id' => 'zero-write-target', 'title' => 'x', 'tags' => ['existing'], 'workflowStatus' => 'draft',
        ]]], $this->authHeaders())->assertOk();

        $id = $this->postJson('/api/v1/bulk-macros', ['name' => 'macro', 'steps' => [
            ['type' => 'add-tag', 'tag' => 'featured'],
            ['type' => 'set-workflow-status', 'status' => 'approved'],
            ['type' => 'delete'],
        ]], $this->authHeaders())->assertCreated()->json('macro.id');

        $before = $this->snapshot('zero-write-target');

        $this->postJson("/api/v1/bulk-macros/{$id}/preview", [
            'targets' => [['store' => 'archive-items', 'id' => 'zero-write-target']],
        ], $this->authHeaders())->assertOk();

        $this->assertSame($before, $this->snapshot('zero-write-target'));
    }

    public function test_safety_preview_run_writes_nothing_to_the_real_database(): void
    {
        $before = $this->counts();

        $this->postJson('/api/v1/safety-preview/run', [
            'scenario' => 'bulk-delete-basic', 'operation' => 'delete', 'ids' => ['alpha', 'bravo', 'charlie'],
        ], $this->authHeaders())->assertOk()->assertJsonPath('synthetic', true);

        $this->assertSame($before, $this->counts());
    }

    /** @return array{storageRows: int, trashedRecords: int, bulkMacroRuns: int, recordChecksum: string|null} */
    private function snapshot(string $uid): array
    {
        return [
            ...$this->counts(),
            'recordChecksum' => (string) DB::table('storage_rows')->where('store', 'archive-items')->where('uid', $uid)->value('data'),
        ];
    }

    /** @return array{storageRows: int, trashedRecords: int, bulkMacroRuns: int} */
    private function counts(): array
    {
        return [
            'storageRows' => DB::table('storage_rows')->count(),
            'trashedRecords' => DB::table('trashed_records')->count(),
            'bulkMacroRuns' => DB::table('bulk_macro_runs')->count(),
        ];
    }
}
