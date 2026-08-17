<?php

namespace Tests\Feature;

use App\Events\MediaReviewCommentBroadcasted;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class MediaReviewCommentsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_creates_a_point_in_time_comment_and_broadcasts_it(): void
    {
        Event::fake([MediaReviewCommentBroadcasted::class]);
        $this->seedRecord('record-1');

        $response = $this->postJson('/api/v1/records/record-1/media-review-comments', [
            'type' => 'issue',
            'startSeconds' => 12.5,
            'body' => 'Audio drops out here.',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('comment.recordUid', 'record-1')
            ->assertJsonPath('comment.type', 'issue')
            ->assertJsonPath('comment.startSeconds', 12.5)
            ->assertJsonPath('comment.endSeconds', null)
            ->assertJsonPath('comment.state', 'open');

        Event::assertDispatched(MediaReviewCommentBroadcasted::class, function (MediaReviewCommentBroadcasted $event) use ($response): bool {
            return $event->recordUid === 'record-1'
                && $event->action === 'created'
                && $event->comment['id'] === $response->json('comment.id');
        });
    }

    public function test_creates_a_time_range_chapter_marker(): void
    {
        $this->seedRecord('record-2');

        $this->postJson('/api/v1/records/record-2/media-review-comments', [
            'type' => 'chapter',
            'startSeconds' => 10,
            'endSeconds' => 45,
            'body' => 'Interview segment',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('comment.type', 'chapter')
            ->assertJsonPath('comment.startSeconds', 10)
            ->assertJsonPath('comment.endSeconds', 45);
    }

    public function test_rejects_unknown_comment_type(): void
    {
        $this->seedRecord('record-3');

        $this->postJson('/api/v1/records/record-3/media-review-comments', [
            'type' => 'not-a-real-type',
            'startSeconds' => 1,
            'body' => 'x',
        ], $this->authHeaders())->assertStatus(422);
    }

    public function test_rejects_end_seconds_at_or_before_start_seconds(): void
    {
        $this->seedRecord('record-4');

        $this->postJson('/api/v1/records/record-4/media-review-comments', [
            'type' => 'highlight',
            'startSeconds' => 20,
            'endSeconds' => 20,
            'body' => 'x',
        ], $this->authHeaders())->assertStatus(422);

        $this->postJson('/api/v1/records/record-4/media-review-comments', [
            'type' => 'highlight',
            'startSeconds' => 20,
            'endSeconds' => 5,
            'body' => 'x',
        ], $this->authHeaders())->assertStatus(422);
    }

    public function test_rejects_timestamps_beyond_the_attachments_known_duration(): void
    {
        Storage::fake(config('ingest.disk'));
        $this->seedRecord('record-5');
        $attachmentId = $this->uploadAttachment('record-5');

        // First request establishes the known duration (30s) for the attachment.
        $this->postJson('/api/v1/records/record-5/media-review-comments', [
            'attachmentId' => $attachmentId,
            'type' => 'suggestion',
            'startSeconds' => 5,
            'body' => 'within range',
            'clientDurationSeconds' => 30,
        ], $this->authHeaders())->assertCreated();

        $this->assertSame(30.0, (float) DB::table('record_attachments')->where('id', $attachmentId)->value('duration_seconds'));

        // A later request beyond the now-cached duration is rejected, even
        // without repeating the duration hint.
        $this->postJson('/api/v1/records/record-5/media-review-comments', [
            'attachmentId' => $attachmentId,
            'type' => 'suggestion',
            'startSeconds' => 45,
            'body' => 'beyond range',
        ], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('ok', false);

        // A range whose end exceeds the duration is also rejected.
        $this->postJson('/api/v1/records/record-5/media-review-comments', [
            'attachmentId' => $attachmentId,
            'type' => 'suggestion',
            'startSeconds' => 10,
            'endSeconds' => 31,
            'body' => 'range spills past duration',
        ], $this->authHeaders())->assertStatus(422);
    }

    public function test_resolve_and_reopen_lifecycle(): void
    {
        Event::fake([MediaReviewCommentBroadcasted::class]);
        $this->seedRecord('record-6');
        $id = $this->createComment('record-6');

        $resolved = $this->postJson("/api/v1/media-review-comments/{$id}/resolve", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('comment.state', 'resolved');
        $this->assertNotNull($resolved->json('comment.resolvedBy'));
        $this->assertNotNull($resolved->json('comment.resolvedAt'));

        // Resolving an already-resolved comment is a conflict.
        $this->postJson("/api/v1/media-review-comments/{$id}/resolve", [], $this->authHeaders())
            ->assertStatus(409)->assertJsonPath('code', 'CONFLICT');

        $reopened = $this->postJson("/api/v1/media-review-comments/{$id}/reopen", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('comment.state', 'open');
        $this->assertNull($reopened->json('comment.resolvedBy'));
        $this->assertNull($reopened->json('comment.resolvedAt'));

        // Reopening an already-open comment is a conflict.
        $this->postJson("/api/v1/media-review-comments/{$id}/reopen", [], $this->authHeaders())
            ->assertStatus(409);

        Event::assertDispatched(MediaReviewCommentBroadcasted::class, fn (MediaReviewCommentBroadcasted $e): bool => $e->action === 'resolved');
        Event::assertDispatched(MediaReviewCommentBroadcasted::class, fn (MediaReviewCommentBroadcasted $e): bool => $e->action === 'reopened');
    }

    public function test_update_and_delete_comment(): void
    {
        $this->seedRecord('record-7');
        $id = $this->createComment('record-7');

        $this->patchJson("/api/v1/media-review-comments/{$id}", ['body' => 'edited text'], $this->authHeaders())
            ->assertOk()->assertJsonPath('comment.body', 'edited text');

        $this->deleteJson("/api/v1/media-review-comments/{$id}", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('deleted', true);

        $this->assertDatabaseMissing('media_review_comments', ['id' => $id]);
    }

    public function test_index_lists_comments_ordered_by_start_seconds_and_scoped_to_attachment(): void
    {
        Storage::fake(config('ingest.disk'));
        $this->seedRecord('record-8');
        $attachmentId = $this->uploadAttachment('record-8');

        $this->postJson('/api/v1/records/record-8/media-review-comments', [
            'type' => 'issue', 'startSeconds' => 50, 'body' => 'later marker',
        ], $this->authHeaders())->assertCreated();
        $this->postJson('/api/v1/records/record-8/media-review-comments', [
            'type' => 'issue', 'startSeconds' => 5, 'body' => 'earlier marker',
        ], $this->authHeaders())->assertCreated();
        $this->postJson('/api/v1/records/record-8/media-review-comments', [
            'attachmentId' => $attachmentId, 'type' => 'issue', 'startSeconds' => 1, 'body' => 'attachment marker',
        ], $this->authHeaders())->assertCreated();

        $all = $this->getJson('/api/v1/records/record-8/media-review-comments', $this->authHeaders())
            ->assertOk()->assertJsonCount(3, 'comments');
        // Ordered by startSeconds ascending: attachment marker (1) < earlier marker (5) < later marker (50).
        $this->assertSame('attachment marker', $all->json('comments.0.body'));
        $this->assertSame('earlier marker', $all->json('comments.1.body'));
        $this->assertSame('later marker', $all->json('comments.2.body'));

        $scoped = $this->getJson('/api/v1/records/record-8/media-review-comments?attachmentId='.$attachmentId, $this->authHeaders())
            ->assertOk()->assertJsonCount(1, 'comments');
        $this->assertSame('attachment marker', $scoped->json('comments.0.body'));
    }

    public function test_viewer_cannot_create_resolve_or_delete_but_can_read(): void
    {
        $this->seedRecord('record-9');
        $id = $this->createComment('record-9');
        $viewer = $this->viewerHeaders();

        $this->postJson('/api/v1/records/record-9/media-review-comments', [
            'type' => 'issue', 'startSeconds' => 1, 'body' => 'x',
        ], $viewer)->assertForbidden();

        $this->postJson("/api/v1/media-review-comments/{$id}/resolve", [], $viewer)->assertForbidden();
        $this->deleteJson("/api/v1/media-review-comments/{$id}", [], $viewer)->assertForbidden();

        $this->getJson('/api/v1/records/record-9/media-review-comments', $viewer)->assertOk();
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->seedRecord('record-10');

        $this->postJson('/api/v1/records/record-10/media-review-comments', [
            'type' => 'issue', 'startSeconds' => 1, 'body' => 'x',
        ])->assertUnauthorized();

        $this->getJson('/api/v1/records/record-10/media-review-comments')->assertUnauthorized();
    }

    public function test_missing_record_returns_not_found_on_create(): void
    {
        $this->postJson('/api/v1/records/missing-record/media-review-comments', [
            'type' => 'issue', 'startSeconds' => 1, 'body' => 'x',
        ], $this->authHeaders())->assertNotFound();
    }

    public function test_it_audits_comment_create_and_resolve(): void
    {
        $this->seedRecord('record-11');
        $id = $this->createComment('record-11');

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'media_review_comments.create',
            'resource_type' => 'media_review_comment',
            'resource_id' => 'record-11',
        ]);

        $this->postJson("/api/v1/media-review-comments/{$id}/resolve", [], $this->authHeaders())->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'media_review_comments.resolve',
            'resource_type' => 'media_review_comment',
            'resource_id' => $id,
            'outcome' => 'success',
        ]);
    }

    private function seedRecord(string $uid): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode(['id' => $uid, 'title' => 'Media review comment fixture', 'checksum' => 'checksum-'.$uid], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function uploadAttachment(string $recordId): string
    {
        // .txt keeps this a plain-content fixture -- .mp4 would trip the real
        // magic-byte content/extension mismatch check in RecordAttachmentsController
        // since this body isn't real video data. Same pattern ReviewSessionsApiTest uses.
        $upload = $this->post("/api/v1/records/{$recordId}/attachments", [
            'store' => 'archive-items',
            'files' => [UploadedFile::fake()->createWithContent('clip.txt', 'clip-body')],
        ], $this->authHeaders())->assertCreated();

        return $upload->json('attachments.0.id');
    }

    private function createComment(string $recordId): string
    {
        $id = $this->postJson("/api/v1/records/{$recordId}/media-review-comments", [
            'type' => 'issue',
            'startSeconds' => 3,
            'body' => 'default comment',
        ], $this->authHeaders())->assertCreated()->json('comment.id');
        $this->assertIsString($id);

        return $id;
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Comment Viewer',
            'email' => 'comment-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $viewer->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }
}
