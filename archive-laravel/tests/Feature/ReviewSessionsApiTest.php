<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class ReviewSessionsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_full_lifecycle_from_draft_to_closed_via_approval(): void
    {
        $this->seedRecord('record-1', 'original-checksum');

        $created = $this->postJson('/api/v1/records/record-1/review-sessions', [], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('session.recordUid', 'record-1')
            ->assertJsonPath('session.attachmentId', null)
            ->assertJsonPath('session.state', 'draft')
            ->assertJsonPath('session.versionToken', 'record:original-checksum')
            ->assertJsonPath('session.isCurrentVersion', true)
            ->assertJsonPath('session.decidedBy', null);

        $id = $created->json('session.id');
        $this->assertIsString($id);

        $this->postJson("/api/v1/review-sessions/{$id}/start", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('session.state', 'in_review');

        // Approval comes from a different editor than the one who created
        // the session -- self-approval is refused (see
        // test_the_creator_of_a_review_session_cannot_approve_their_own_submission).
        $approved = $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $this->secondEditorHeaders())
            ->assertOk()->assertJsonPath('session.state', 'approved');
        $this->assertNotNull($approved->json('session.decidedBy'));
        $this->assertNotNull($approved->json('session.decidedAt'));

        $this->postJson("/api/v1/review-sessions/{$id}/close", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('session.state', 'closed');
    }

    public function test_changes_requested_path_allows_resume_before_approval(): void
    {
        $this->seedRecord('record-2', 'checksum-2');
        $id = $this->createSession('record-2');

        $this->postJson("/api/v1/review-sessions/{$id}/start", [], $this->authHeaders())->assertOk();
        $this->postJson("/api/v1/review-sessions/{$id}/request-changes", ['notes' => 'fix the intro'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('session.state', 'changes_requested')
            ->assertJsonPath('session.notes', 'fix the intro');

        $this->postJson("/api/v1/review-sessions/{$id}/resume", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('session.state', 'in_review');

        $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $this->secondEditorHeaders())
            ->assertOk()->assertJsonPath('session.state', 'approved');
    }

    public function test_invalid_transitions_are_rejected_with_409(): void
    {
        $this->seedRecord('record-3', 'checksum-3');
        $id = $this->createSession('record-3');

        // draft -> approve is illegal; must go through in_review first.
        $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $this->authHeaders())
            ->assertStatus(409)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'CONFLICT');

        // draft -> request_changes is illegal.
        $this->postJson("/api/v1/review-sessions/{$id}/request-changes", [], $this->authHeaders())
            ->assertStatus(409);

        $this->postJson("/api/v1/review-sessions/{$id}/start", [], $this->authHeaders())->assertOk();
        $this->postJson("/api/v1/review-sessions/{$id}/close", [], $this->authHeaders())->assertOk();

        // closed is terminal; every transition should now be rejected.
        foreach (['start', 'request-changes', 'approve', 'resume', 'close'] as $action) {
            $this->postJson("/api/v1/review-sessions/{$id}/{$action}", [], $this->authHeaders())
                ->assertStatus(409);
        }
    }

    public function test_replacing_the_source_does_not_carry_the_approval_to_the_new_version(): void
    {
        $disk = config('ingest.disk');
        Storage::fake($disk);
        Storage::disk($disk)->put('ingest/uploads/original.txt', 'original');
        $this->seedRecord('record-4', hash('sha256', 'original'), 'ingest/uploads/original.txt', 'original.txt');

        $id = $this->createSession('record-4');
        $this->postJson("/api/v1/review-sessions/{$id}/start", [], $this->authHeaders())->assertOk();
        $approved = $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $this->secondEditorHeaders())
            ->assertOk()->assertJsonPath('session.state', 'approved')->assertJsonPath('session.isCurrentVersion', true);
        $originalToken = $approved->json('session.versionToken');

        $this->post('/api/v1/records/record-4/source-replacements', [
            'file' => UploadedFile::fake()->createWithContent('replacement.txt', 'replacement'),
        ], $this->authHeaders())->assertOk();

        // The already-approved session keeps its state and its pinned token,
        // but is no longer reporting itself as covering the live content.
        $stale = $this->getJson("/api/v1/review-sessions/{$id}", $this->authHeaders())->assertOk();
        $this->assertSame('approved', $stale->json('session.state'));
        $this->assertSame($originalToken, $stale->json('session.versionToken'));
        $this->assertFalse($stale->json('session.isCurrentVersion'));

        // A freshly opened session for the same record captures the new
        // version and starts back at draft -- the old approval never
        // transfers to it.
        $fresh = $this->postJson('/api/v1/records/record-4/review-sessions', [], $this->authHeaders())->assertCreated();
        $this->assertNotSame($originalToken, $fresh->json('session.versionToken'));
        $this->assertSame('draft', $fresh->json('session.state'));
        $this->assertTrue($fresh->json('session.isCurrentVersion'));
    }

    public function test_attachment_scoped_review_session_tracks_the_attachment_checksum(): void
    {
        Storage::fake(config('ingest.disk'));
        $this->seedRecord('record-5', 'record-checksum');

        $upload = $this->post('/api/v1/records/record-5/attachments', [
            'store' => 'archive-items',
            'files' => [UploadedFile::fake()->createWithContent('notes.txt', 'attachment-body')],
        ], $this->authHeaders())->assertCreated();
        $attachmentId = $upload->json('attachments.0.id');
        $expectedChecksum = hash('sha256', 'attachment-body');

        $session = $this->postJson('/api/v1/records/record-5/review-sessions', [
            'attachmentId' => $attachmentId,
        ], $this->authHeaders())->assertCreated();

        $session->assertJsonPath('session.attachmentId', $attachmentId)
            ->assertJsonPath('session.versionToken', 'attachment:'.$expectedChecksum);
    }

    public function test_viewer_cannot_create_or_transition_review_sessions(): void
    {
        $this->seedRecord('record-6', 'checksum-6');
        $id = $this->createSession('record-6');
        $this->postJson("/api/v1/review-sessions/{$id}/start", [], $this->authHeaders())->assertOk();

        $viewer = $this->viewerHeaders();

        $this->postJson('/api/v1/records/record-6/review-sessions', [], $viewer)
            ->assertForbidden()->assertJsonPath('ok', false);

        $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $viewer)
            ->assertForbidden();

        $this->assertSame('in_review', DB::table('review_sessions')->where('id', $id)->value('state'));
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->seedRecord('record-7', 'checksum-7');

        $this->postJson('/api/v1/records/record-7/review-sessions')
            ->assertUnauthorized()->assertJsonPath('ok', false);

        $this->getJson('/api/v1/records/record-7/review-sessions')
            ->assertUnauthorized();
    }

    public function test_missing_record_returns_not_found_on_create(): void
    {
        $this->postJson('/api/v1/records/missing-record/review-sessions', [], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('ok', false);
    }

    public function test_missing_session_returns_not_found_for_show_update_delete_and_transitions(): void
    {
        $this->getJson('/api/v1/review-sessions/does-not-exist', $this->authHeaders())->assertNotFound();
        $this->patchJson('/api/v1/review-sessions/does-not-exist', ['notes' => null], $this->authHeaders())->assertNotFound();
        $this->deleteJson('/api/v1/review-sessions/does-not-exist', [], $this->authHeaders())->assertNotFound();
        $this->postJson('/api/v1/review-sessions/does-not-exist/start', [], $this->authHeaders())->assertNotFound();
    }

    public function test_update_notes_and_delete_review_session(): void
    {
        $this->seedRecord('record-8', 'checksum-8');
        $id = $this->createSession('record-8');

        $this->patchJson("/api/v1/review-sessions/{$id}", ['notes' => 'reviewer context'], $this->authHeaders())
            ->assertOk()->assertJsonPath('session.notes', 'reviewer context');

        $this->deleteJson("/api/v1/review-sessions/{$id}", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('deleted', true);

        $this->assertDatabaseMissing('review_sessions', ['id' => $id]);
    }

    public function test_index_lists_sessions_scoped_to_record_and_optional_attachment(): void
    {
        Storage::fake(config('ingest.disk'));
        $this->seedRecord('record-9', 'checksum-9');

        $upload = $this->post('/api/v1/records/record-9/attachments', [
            'store' => 'archive-items',
            'files' => [UploadedFile::fake()->createWithContent('a.txt', 'a-body')],
        ], $this->authHeaders())->assertCreated();
        $attachmentId = $upload->json('attachments.0.id');

        $sourceSession = $this->createSession('record-9');
        $attachmentSession = $this->postJson('/api/v1/records/record-9/review-sessions', [
            'attachmentId' => $attachmentId,
        ], $this->authHeaders())->json('session.id');

        $this->getJson('/api/v1/records/record-9/review-sessions', $this->authHeaders())
            ->assertOk()->assertJsonCount(2, 'sessions');

        $filtered = $this->getJson('/api/v1/records/record-9/review-sessions?attachmentId='.$attachmentId, $this->authHeaders())
            ->assertOk()->assertJsonCount(1, 'sessions');
        $this->assertSame($attachmentSession, $filtered->json('sessions.0.id'));
        $this->assertNotSame($sourceSession, $attachmentSession);
    }

    public function test_it_audits_review_session_create_and_approve(): void
    {
        $this->seedRecord('record-10', 'checksum-10');
        $id = $this->createSession('record-10');

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'review_sessions.create',
            'resource_type' => 'review_session',
            'resource_id' => 'record-10',
        ]);

        $this->postJson("/api/v1/review-sessions/{$id}/start", [], $this->authHeaders())->assertOk();
        $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $this->secondEditorHeaders())->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'review_sessions.approve',
            'resource_type' => 'review_session',
            'resource_id' => $id,
            'outcome' => 'success',
        ]);
    }

    public function test_the_creator_of_a_review_session_cannot_approve_their_own_submission(): void
    {
        // V3-WORK-003: deferred here from V3-MEDIA-002. The creator starts
        // and then tries to approve their own session -- must be refused
        // server-side, and the session must stay unchanged (still in_review).
        $this->seedRecord('record-11', 'checksum-11');
        $id = $this->createSession('record-11');
        $this->postJson("/api/v1/review-sessions/{$id}/start", [], $this->authHeaders())->assertOk();

        $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $this->authHeaders())
            ->assertStatus(403)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'self_approval');

        $this->assertSame('in_review', DB::table('review_sessions')->where('id', $id)->value('state'));
        $this->assertNull(DB::table('review_sessions')->where('id', $id)->value('decided_by'));

        // A different editor can approve the same session without issue.
        $this->postJson("/api/v1/review-sessions/{$id}/approve", [], $this->secondEditorHeaders())
            ->assertOk()->assertJsonPath('session.state', 'approved');
    }

    public function test_review_sessions_are_isolated_to_their_record_store(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive',
            'uid' => 'cross-store-record',
            'data' => json_encode(['id' => 'cross-store-record', 'checksum' => 'cross-checksum'], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/records/cross-store-record/review-sessions?store=archive', [], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('session.recordStore', 'archive');

        // Default store lookup must not see the record that only exists in
        // the "archive" store.
        $this->postJson('/api/v1/records/cross-store-record/review-sessions', [], $this->authHeaders())
            ->assertNotFound();
    }

    private function seedRecord(string $uid, string $checksum, ?string $filePath = null, ?string $fileName = null): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode([
                'id' => $uid,
                'title' => 'Review session fixture',
                'checksum' => $checksum,
                'filePath' => $filePath,
                'fileName' => $fileName,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createSession(string $recordId): string
    {
        $id = $this->postJson("/api/v1/records/{$recordId}/review-sessions", [], $this->authHeaders())
            ->assertCreated()
            ->json('session.id');
        $this->assertIsString($id);

        return $id;
    }

    /**
     * @return array<string, string>
     */
    private function secondEditorHeaders(): array
    {
        $editor = User::query()->firstOrCreate(
            ['email' => 'second-review-editor@example.test'],
            ['name' => 'Second Editor', 'password' => Hash::make('secret-password'), 'role' => 'editor'],
        );

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $editor->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Review Viewer',
            'email' => 'review-viewer@example.test',
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
