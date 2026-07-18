<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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

    public function test_author_can_mutate_note_but_another_editor_sees_not_found(): void
    {
        $this->seedArchiveRecord();
        $author = $this->headersFor('viewer', 'note-author@example.test');
        $other = $this->headersFor('editor', 'note-other@example.test');
        $id = $this->postJson('/api/v1/records/item-1/notes', ['body' => 'Private'], $author)
            ->assertCreated()->json('note.id');

        $this->patchJson('/api/v1/record-notes/'.$id, ['body' => 'No access'], $other)->assertNotFound();
        $this->deleteJson('/api/v1/record-notes/'.$id, [], $other)->assertNotFound();
        $this->patchJson('/api/v1/record-notes/'.$id, ['body' => 'Mine'], $author)->assertOk();
        $this->deleteJson('/api/v1/record-notes/'.$id, [], $author)->assertOk();
    }

    public function test_admin_can_mutate_another_users_note_and_orphan_notes_are_admin_only(): void
    {
        $this->seedArchiveRecord();
        $author = $this->headersFor('viewer', 'note-owner@example.test');
        $admin = $this->headersFor('admin', 'note-admin@example.test');
        $id = $this->postJson('/api/v1/records/item-1/notes', ['body' => 'Owned'], $author)->json('note.id');
        $this->patchJson('/api/v1/record-notes/'.$id, ['body' => 'Moderated'], $admin)->assertOk();

        $orphanId = '00000000-0000-4000-8000-000000000001';
        DB::table('record_notes')->insert(['id' => $orphanId, 'item_id' => 'item-1', 'body' => 'Legacy', 'author_id' => null, 'author_name' => 'Legacy', 'created_at' => now(), 'updated_at' => now()]);
        $this->patchJson('/api/v1/record-notes/'.$orphanId, ['body' => 'Claimed'], $author)->assertNotFound();
        $this->deleteJson('/api/v1/record-notes/'.$orphanId, [], $admin)->assertOk();
    }

    private function seedArchiveRecord(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            // Keep the storage-row identity distinct from the public record
            // identity so this exercises the JSON fallback used by imported
            // records as well as directly-created ones.
            'uid' => 'storage-item-1',
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

    /** @return array<string, string> */
    private function headersFor(string $role, string $email): array
    {
        User::query()->create(['name' => $role, 'email' => $email, 'password' => Hash::make('secret-password'), 'role' => $role]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'secret-password'])->assertOk()->json('accessToken');
        return ['Authorization' => 'Bearer '.$token];
    }
}
