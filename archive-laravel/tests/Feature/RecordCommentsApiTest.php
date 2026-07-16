<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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

    public function test_author_can_delete_their_own_comment(): void
    {
        $this->seedArchiveRecord();

        $created = $this->postJson('/api/v1/records/item-1/comments', [
            'body' => 'Author owned comment',
        ], $this->authHeaders())->assertCreated();

        $commentId = $created->json('comment.id');

        $this->deleteJson('/api/v1/record-comments/'.$commentId, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->assertNotNull(DB::table('record_comments')->where('id', $commentId)->value('deleted_at'));
    }

    public function test_non_author_non_admin_cannot_delete_another_users_comment(): void
    {
        $this->seedArchiveRecord();

        $created = $this->postJson('/api/v1/records/item-1/comments', [
            'body' => 'Original author comment',
        ], $this->authHeaders())->assertCreated();

        $commentId = $created->json('comment.id');

        $this->deleteJson('/api/v1/record-comments/'.$commentId, [], $this->otherViewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'forbidden');

        $this->assertNull(DB::table('record_comments')->where('id', $commentId)->value('deleted_at'));

        $log = DB::table('audit_logs')->latest('id')->first();
        $this->assertSame('record_comments.delete', $log?->event);
        $this->assertSame('rejected', $log?->outcome);
        $this->assertSame(403, $log?->status_code);
    }

    public function test_admin_can_delete_another_users_comment(): void
    {
        $this->seedArchiveRecord();

        $created = $this->postJson('/api/v1/records/item-1/comments', [
            'body' => 'Comment deleted by admin override',
        ], $this->authHeaders())->assertCreated();

        $commentId = $created->json('comment.id');

        $this->deleteJson('/api/v1/record-comments/'.$commentId, [], $this->adminOverrideHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->assertNotNull(DB::table('record_comments')->where('id', $commentId)->value('deleted_at'));
    }

    private function seedArchiveRecord(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            // Imported records can have a storage uid that differs from the
            // public id, which must remain addressable by this endpoint.
            'uid' => 'storage-item-1',
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

    /**
     * @return array<string, string>
     */
    private function otherViewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Other Viewer',
            'email' => 'other-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($viewer)];
    }

    /**
     * @return array<string, string>
     */
    private function adminOverrideHeaders(): array
    {
        $admin = User::query()->create([
            'name' => 'Comment Admin',
            'email' => 'comment-admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    private function tokenFor(User $user): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return $login->json('accessToken');
    }
}
