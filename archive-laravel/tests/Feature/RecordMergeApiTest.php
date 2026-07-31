<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordMergeApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_preview_reports_relation_note_and_comment_counts(): void
    {
        $this->seedRecord('item-primary', ['keep']);
        $this->seedRecord('item-dup', ['dup-tag']);
        $this->seedRelation('item-dup', 'item-other');
        $this->seedNote('item-dup');
        $this->seedComment('item-dup');

        $this->postJson('/api/v1/records/item-primary/merge-preview', ['duplicateIds' => ['item-dup']], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('duplicates.0.id', 'item-dup')
            ->assertJsonPath('duplicates.0.found', true)
            ->assertJsonPath('relationCount', 1)
            ->assertJsonPath('noteCount', 1)
            ->assertJsonPath('commentCount', 1);
    }

    public function test_merge_transfers_tags_relations_notes_and_soft_deletes_the_duplicate(): void
    {
        $this->seedRecord('item-primary', ['keep']);
        $this->seedRecord('item-dup', ['dup-tag']);
        $this->seedRelation('item-dup', 'item-other');
        $this->seedNote('item-dup');
        $this->seedComment('item-dup');

        $this->postJson('/api/v1/records/item-primary/merge', ['duplicateIds' => ['item-dup']], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('primaryId', 'item-primary')
            ->assertJsonPath('merged.0', 'item-dup');

        $primary = $this->getJson('/api/v1/records/item-primary?store=archive-items', $this->authHeaders())->assertOk();
        $tags = $primary->json('record.tags');
        $this->assertContains('keep', $tags);
        $this->assertContains('dup-tag', $tags);

        $this->assertSame(0, DB::table('storage_rows')->where('store', 'archive-items')->where('uid', 'item-dup')->count());
        $this->assertSame(1, DB::table('trashed_records')->where('store', 'archive-items')->where('uid', 'item-dup')->count());
        $this->assertSame('item-primary', DB::table('record_relations')->where('source_record_id', 'item-primary')->value('source_record_id'));
        $this->assertSame(0, DB::table('record_relations')->where('source_record_id', 'item-dup')->count());
        $this->assertSame(0, DB::table('record_notes')->where('item_id', 'item-dup')->count());
        $this->assertSame(1, DB::table('record_notes')->where('item_id', 'item-primary')->count());
    }

    public function test_merging_an_unknown_duplicate_is_silently_skipped(): void
    {
        $this->seedRecord('item-primary', []);

        $this->postJson('/api/v1/records/item-primary/merge', ['duplicateIds' => ['does-not-exist']], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('merged', []);
    }

    public function test_merge_requires_an_editor(): void
    {
        $this->seedRecord('item-primary', []);
        $this->seedRecord('item-dup', []);
        $viewer = \App\Models\User::query()->create(['name' => 'v', 'email' => 'viewer@example.com', 'password' => \Illuminate\Support\Facades\Hash::make('secret-password'), 'role' => 'viewer']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'viewer@example.com', 'password' => 'secret-password'])->assertOk()->json('accessToken');

        $this->postJson('/api/v1/records/item-primary/merge', ['duplicateIds' => ['item-dup']], ['Authorization' => 'Bearer '.$token])
            ->assertStatus(403);
    }

    private function seedRecord(string $id, array $tags): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $id,
            'data' => json_encode(['uid' => $id, 'id' => $id, 'title' => 'Record '.$id, 'tags' => $tags], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedRelation(string $sourceId, string $targetId): void
    {
        DB::table('record_relations')->insert([
            'id' => (string) Str::uuid(),
            'source_record_id' => $sourceId,
            'target_record_id' => $targetId,
            'type' => 'related_to',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedNote(string $recordId): void
    {
        DB::table('record_notes')->insert([
            'id' => (string) Str::uuid(),
            'item_id' => $recordId,
            'record_store' => 'archive-items',
            'body' => 'note',
            'author_name' => 'مجهول',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedComment(string $recordId): void
    {
        DB::table('record_comments')->insert([
            'id' => (string) Str::uuid(),
            'item_id' => $recordId,
            'record_store' => 'archive-items',
            'body' => 'comment',
            'author_name' => 'مجهول',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
