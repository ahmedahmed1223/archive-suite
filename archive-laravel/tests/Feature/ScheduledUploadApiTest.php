<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1-712 Task 2: POST /api/v1/uploads/schedules stages a completed chunked
 * upload session (V1-711) into a scheduled upload row without moving it into
 * the servable directory yet.
 */
class ScheduledUploadApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    private const VALID_MP4 = "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom\x00\x00\x00\x00\x00\x00\x00\x00";

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('ingest.disk'));
        config(['ingest.chunk_upload.min_chunk_bytes' => 1]);
    }

    private function editorHeaders(): array
    {
        return $this->authHeaders();
    }

    private function viewerHeaders(): array
    {
        User::query()->firstOrCreate(
            ['email' => 'viewer-schedules@example.test'],
            ['name' => 'Viewer', 'password' => Hash::make('secret-password'), 'role' => 'viewer'],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'viewer-schedules@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }

    /**
     * Creates a fully-uploaded (all chunks received) session and returns its
     * id, ready to be staged.
     */
    private function completedSession(string $content = self::VALID_MP4, int $chunkSize = 10): string
    {
        $remainder = strlen($content) % $chunkSize;
        $padded = $content.($remainder === 0 ? '' : str_repeat('x', $chunkSize - $remainder));
        $chunks = str_split($padded, $chunkSize);

        $session = $this->postJson('/api/v1/uploads/sessions', [
            'fileName' => 'clip.mp4',
            'totalSize' => strlen($padded),
            'chunkSize' => $chunkSize,
            'checksum' => hash('sha256', $padded),
        ], $this->editorHeaders())->assertCreated()->json('session');

        foreach ($chunks as $index => $chunk) {
            $this->call(
                'PUT',
                "/api/v1/uploads/sessions/{$session['id']}/chunks/{$index}",
                [],
                [],
                [],
                array_merge($this->transformHeadersToServerVars($this->editorHeaders()), [
                    'CONTENT_TYPE' => 'application/octet-stream',
                ]),
                $chunk,
            )->assertOk();
        }

        return $session['id'];
    }

    private function schedulePayload(array $overrides = []): array
    {
        return array_merge([
            'scheduledAt' => now()->addHour()->toIso8601String(),
            'timeZone' => 'Europe/Istanbul',
            'idempotencyKey' => 'schedule-fixture-001',
            'record' => ['title' => 'مقابلة مجدولة', 'type' => 'video', 'tags' => ['مقابلة']],
        ], $overrides);
    }

    public function test_authenticated_editor_creates_a_schedule(): void
    {
        $sessionId = $this->completedSession();

        $response = $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $sessionId],
            $this->schedulePayload(),
        ), $this->editorHeaders())->assertCreated();

        $response->assertJsonPath('schedule.status', 'scheduled')
            ->assertJsonMissingPath('schedule.stagedPath')
            ->assertJsonMissingPath('schedule.disk');

        $this->assertDatabaseHas('scheduled_uploads', [
            'idempotency_key' => 'schedule-fixture-001',
            'status' => 'scheduled',
            'file_name' => 'clip.mp4',
        ]);
        $this->assertDatabaseHas('upload_sessions', ['id' => $sessionId, 'status' => 'staged']);
    }

    public function test_viewer_is_forbidden(): void
    {
        $sessionId = $this->completedSession();

        $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $sessionId],
            $this->schedulePayload(['idempotencyKey' => 'schedule-fixture-002']),
        ), $this->viewerHeaders())->assertStatus(403);
    }

    public function test_past_scheduled_time_is_rejected(): void
    {
        $sessionId = $this->completedSession();

        $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $sessionId],
            $this->schedulePayload([
                'scheduledAt' => now()->subHour()->toIso8601String(),
                'idempotencyKey' => 'schedule-fixture-003',
            ]),
        ), $this->editorHeaders())->assertStatus(422);
    }

    public function test_invalid_time_zone_is_rejected(): void
    {
        $sessionId = $this->completedSession();

        $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $sessionId],
            $this->schedulePayload([
                'timeZone' => 'Not/AZone',
                'idempotencyKey' => 'schedule-fixture-004',
            ]),
        ), $this->editorHeaders())->assertStatus(422);
    }

    public function test_incomplete_session_returns_conflict(): void
    {
        $session = $this->postJson('/api/v1/uploads/sessions', [
            'fileName' => 'clip.mp4',
            'totalSize' => 30,
            'chunkSize' => 10,
        ], $this->editorHeaders())->assertCreated()->json('session');

        // Only the first of 3 chunks arrives.
        $this->call(
            'PUT',
            "/api/v1/uploads/sessions/{$session['id']}/chunks/0",
            [],
            [],
            [],
            array_merge($this->transformHeadersToServerVars($this->editorHeaders()), [
                'CONTENT_TYPE' => 'application/octet-stream',
            ]),
            str_repeat('a', 10),
        )->assertOk();

        $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $session['id']],
            $this->schedulePayload(['idempotencyKey' => 'schedule-fixture-005']),
        ), $this->editorHeaders())
            ->assertStatus(409)
            ->assertJsonPath('code', 'incomplete_upload');
    }

    /**
     * TOCTOU regression: the pre-transaction pending/complete check is only a
     * fast path. Simulates a concurrent request that stages the same session
     * in the window between that outer check and the lockForUpdate() select
     * inside the transaction, by hooking the outer select via DB::listen and
     * flipping the row's status right after it fires (before the code that
     * ran it sees the mutation — its result was already fetched). The
     * lockForUpdate() re-select inside the transaction runs after that
     * mutation and must be the one that actually gates staging.
     */
    public function test_recheck_under_lock_catches_status_changed_after_outer_check(): void
    {
        $sessionId = $this->completedSession();

        $raced = false;
        DB::listen(function ($query) use ($sessionId, &$raced) {
            if ($raced || ! str_contains($query->sql, 'upload_sessions') || ! str_starts_with(trim($query->sql), 'select')) {
                return;
            }

            $raced = true;
            DB::table('upload_sessions')->where('id', $sessionId)->update(['status' => 'staged']);
        });

        $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $sessionId],
            $this->schedulePayload(['idempotencyKey' => 'schedule-fixture-race']),
        ), $this->editorHeaders())
            ->assertStatus(409)
            ->assertJsonPath('code', 'session_inactive');

        $this->assertDatabaseMissing('scheduled_uploads', ['idempotency_key' => 'schedule-fixture-race']);
    }

    public function test_duplicate_idempotency_key_returns_the_existing_schedule(): void
    {
        $firstSessionId = $this->completedSession();

        $first = $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $firstSessionId],
            $this->schedulePayload(['idempotencyKey' => 'schedule-fixture-006']),
        ), $this->editorHeaders())->assertCreated();

        $secondSessionId = $this->completedSession();

        $second = $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $secondSessionId],
            $this->schedulePayload(['idempotencyKey' => 'schedule-fixture-006']),
        ), $this->editorHeaders())->assertOk();

        $this->assertSame($first->json('schedule.id'), $second->json('schedule.id'));
        // The second session was never staged/consumed.
        $this->assertDatabaseHas('upload_sessions', ['id' => $secondSessionId, 'status' => 'pending']);
    }

    public function test_staged_session_rejects_later_chunks_and_complete(): void
    {
        $sessionId = $this->completedSession();

        $this->postJson('/api/v1/uploads/schedules', array_merge(
            ['uploadSessionId' => $sessionId],
            $this->schedulePayload(['idempotencyKey' => 'schedule-fixture-007']),
        ), $this->editorHeaders())->assertCreated();

        $this->call(
            'PUT',
            "/api/v1/uploads/sessions/{$sessionId}/chunks/0",
            [],
            [],
            [],
            array_merge($this->transformHeadersToServerVars($this->editorHeaders()), [
                'CONTENT_TYPE' => 'application/octet-stream',
            ]),
            str_repeat('a', 10),
        )->assertStatus(410);

        $this->postJson("/api/v1/uploads/sessions/{$sessionId}/complete", [], $this->editorHeaders())
            ->assertStatus(410);
    }
}
