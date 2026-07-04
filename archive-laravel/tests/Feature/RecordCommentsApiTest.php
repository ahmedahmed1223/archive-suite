<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordCommentsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_and_soft_deletes_record_comments(): void
    {
        $this->seedArchiveRecord();

        $first = $this->postJson('/api/v1/records/item-1/comments', [
            'body' => 'First team comment',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('comment.itemId', 'item-1')
            ->assertJsonPath('comment.body', 'First team comment');

        $second = $this->postJson('/api/v1/records/item-1/comments', [
            'body' => 'Second team comment',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('comment.body', 'Second team comment');

        $firstId = $first->json('comment.id');
        $secondId = $second->json('comment.id');
        $this->assertIsString($firstId);
        $this->assertIsString($secondId);

        $this->getJson('/api/v1/records/item-1/comments', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'comments')
            ->assertJsonPath('comments.0.id', $firstId)
            ->assertJsonPath('comments.1.id', $secondId);

        $this->deleteJson('/api/v1/record-comments/'.$firstId, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        // Soft delete: excluded from listing, but row remains for audit history.
        $this->getJson('/api/v1/records/item-1/comments', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'comments')
            ->assertJsonPath('comments.0.id', $secondId);

        $this->assertDatabaseHas('record_comments', ['id' => $firstId]);
        $this->assertNotNull(DB::table('record_comments')->where('id', $firstId)->value('deleted_at'));
    }

    public function test_it_rejects_missing_records_and_invalid_comments(): void
    {
        $this->seedArchiveRecord();

        $this->getJson('/api/v1/records/missing/comments', $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');

        $this->postJson('/api/v1/records/item-1/comments', [
            'body' => '',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_unauthenticated_record_comments_requests(): void
    {
        $this->getJson('/api/v1/records/item-1/comments')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_it_audits_comment_create_and_delete(): void
    {
        $this->seedArchiveRecord();

        $created = $this->postJson('/api/v1/records/item-1/comments', [
            'body' => 'Audited comment',
        ], $this->authHeaders())->assertCreated();

        $commentId = $created->json('comment.id');

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'record_comments.create',
            'resource_type' => 'record_comment',
            'resource_id' => 'item-1',
        ]);

        $this->deleteJson('/api/v1/record-comments/'.$commentId, [], $this->authHeaders())->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'record_comments.delete',
            'resource_type' => 'record_comment',
            'resource_id' => $commentId,
        ]);
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
                'title' => 'Record with comments',
                'type' => 'video',
                'tags' => ['comments'],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
