<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordHistoryApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_lists_audit_backed_history_for_a_record(): void
    {
        $this->seedArchiveRecord();

        // Creating a note against item-1 is audited via archive.audit middleware.
        $this->postJson('/api/v1/records/item-1/notes', ['body' => 'A note'], $this->authHeaders())
            ->assertCreated();

        $this->getJson('/api/v1/records/item-1/history', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('entries.0.event', 'record_notes.create')
            ->assertJsonPath('entries.0.resourceType', 'record_note')
            ->assertJsonPath('entries.0.outcome', 'success');
    }

    public function test_it_rejects_missing_records(): void
    {
        $this->seedArchiveRecord();

        $this->getJson('/api/v1/records/missing/history', $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_includes_sanitized_before_and_after_values_for_a_record_update(): void
    {
        $this->seedArchiveRecord();

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [[
                'uid' => 'item-1', 'id' => 'item-1', 'title' => 'Updated history title',
                'type' => 'video', 'tags' => ['history'], 'apiToken' => 'must-not-leak',
            ]],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/item-1/history', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('entries.0.event', 'records.bulk_upsert')
            ->assertJsonPath('entries.0.metadata.diff.before.title', 'Record with history')
            ->assertJsonPath('entries.0.metadata.diff.after.title', 'Updated history title')
            ->assertJsonMissingPath('entries.0.metadata.diff.after.apiToken')
            ->assertJsonPath('entries.0.metadata.diff.fields', ['title']);
    }

    public function test_it_rejects_unauthenticated_history_requests(): void
    {
        $this->getJson('/api/v1/records/item-1/history')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_it_signals_more_history_exists_beyond_the_page_limit(): void
    {
        $this->seedArchiveRecord();

        $now = now();
        for ($i = 0; $i < 4; $i++) {
            DB::table('audit_logs')->insert([
                'action' => 'test.action',
                'event' => 'test.event',
                'resource_type' => 'record',
                'resource_id' => 'item-1',
                'actor_id' => 1,
                'outcome' => 'success',
                'status_code' => 200,
                'created_at' => $now->copy()->addSeconds($i),
            ]);
        }

        $response = $this->getJson('/api/v1/records/item-1/history?limit=3', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('pagination.total', 4)
            ->assertJsonPath('pagination.limit', 3)
            ->assertJsonPath('pagination.page', 1)
            ->assertJsonPath('pagination.hasMore', true);

        $this->assertCount(3, $response->json('entries'));
    }

    private function seedArchiveRecord(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            // Exercise the JSON id fallback instead of matching the storage
            // row's uid directly.
            'uid' => 'storage-item-1',
            'data' => json_encode([
                'uid' => 'item-1',
                'id' => 'item-1',
                'title' => 'Record with history',
                'type' => 'video',
                'tags' => ['history'],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
