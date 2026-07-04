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

    public function test_it_rejects_unauthenticated_history_requests(): void
    {
        $this->getJson('/api/v1/records/item-1/history')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    private function seedArchiveRecord(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'item-1',
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
