<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordNotesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_updates_and_deletes_record_notes(): void
    {
        $this->seedArchiveRecord();

        $first = $this->postJson('/api/v1/records/item-1/notes', [
            'body' => 'General note',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('note.itemId', 'item-1')
            ->assertJsonPath('note.body', 'General note')
            ->assertJsonPath('note.timestampSeconds', null);

        $second = $this->postJson('/api/v1/records/item-1/notes', [
            'body' => 'Timed note',
            'timestampSeconds' => 83.4,
            'region' => ['x' => 0.1, 'y' => 0.2, 'w' => 0.3, 'h' => 0.4],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('note.body', 'Timed note')
            ->assertJsonPath('note.region.x', 0.1);

        $firstId = $first->json('note.id');
        $secondId = $second->json('note.id');
        $this->assertIsString($firstId);
        $this->assertIsString($secondId);

        $this->getJson('/api/v1/records/item-1/notes', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('notes.0.id', $secondId)
            ->assertJsonPath('notes.1.id', $firstId);

        $this->patchJson('/api/v1/record-notes/'.$firstId, [
            'body' => 'Updated general note',
            'timestampSeconds' => 12,
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('note.body', 'Updated general note')
            ->assertJsonPath('note.timestampSeconds', 12);

        $this->deleteJson('/api/v1/record-notes/'.$secondId, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/records/item-1/notes', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'notes')
            ->assertJsonPath('notes.0.id', $firstId);
    }

    public function test_it_rejects_missing_records_and_invalid_notes(): void
    {
        $this->seedArchiveRecord();

        $this->getJson('/api/v1/records/missing/notes', $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');

        $this->postJson('/api/v1/records/item-1/notes', [
            'body' => '',
        ], $this->authHeaders())->assertUnprocessable();

        $this->postJson('/api/v1/records/item-1/notes', [
            'body' => 'Bad timestamp',
            'timestampSeconds' => -1,
        ], $this->authHeaders())->assertUnprocessable();

        $this->postJson('/api/v1/records/item-1/notes', [
            'body' => 'Bad region',
            'region' => ['x' => 0, 'y' => 0, 'w' => 0, 'h' => 1],
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_unauthenticated_record_notes_requests(): void
    {
        $this->getJson('/api/v1/records/item-1/notes')
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
                'title' => 'Record with notes',
                'type' => 'video',
                'tags' => ['notes'],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
