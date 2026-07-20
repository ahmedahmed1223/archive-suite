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
     * @return array{0: array<string, string>, 1: int}
     */
    private function secondEditorHeadersWithId(): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'editor2-schedules@example.test'],
            ['name' => 'Editor Two', 'password' => Hash::make('secret-password'), 'role' => 'editor'],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'editor2-schedules@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return [['Authorization' => 'Bearer '.$token], $user->id];
    }

    /**
     * @return array{0: array<string, string>, 1: int}
     */
    private function adminHeadersWithId(): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'admin-schedules@example.test'],
            ['name' => 'Admin', 'password' => Hash::make('secret-password'), 'role' => 'admin'],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin-schedules@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return [['Authorization' => 'Bearer '.$token], $user->id];
    }

    private function editorUserId(): int
    {
        // authHeaders()/editorHeaders() logs in as this fixed user (see
        // AuthenticatesArchiveRequests) — look it up rather than duplicating
        // creation so ownership assertions use the same id the token maps to.
        // Ensure the login (and therefore the firstOrCreate) has run first.
        $this->editorHeaders();

        return User::query()->where('email', 'admin@example.test')->firstOrFail()->id;
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

    public function test_editor_sees_only_owned_schedules(): void
    {
        $editorId = $this->editorUserId();
        [$otherHeaders, $otherId] = $this->secondEditorHeadersWithId();

        $mine = \App\Models\ScheduledUpload::factory()->create(['created_by' => $editorId]);
        \App\Models\ScheduledUpload::factory()->create(['created_by' => $otherId]);

        $response = $this->getJson('/api/v1/uploads/schedules', $this->editorHeaders())->assertOk();

        $ids = collect($response->json('schedules'))->pluck('id');
        $this->assertTrue($ids->contains($mine->id));
        $this->assertCount(1, $ids);
        $this->assertNull($response->json('schedules.0.stagedPath'));
    }

    public function test_admin_sees_all_schedules(): void
    {
        $editorId = $this->editorUserId();
        [, $otherId] = $this->secondEditorHeadersWithId();
        [$adminHeaders] = $this->adminHeadersWithId();

        \App\Models\ScheduledUpload::factory()->create(['created_by' => $editorId]);
        \App\Models\ScheduledUpload::factory()->create(['created_by' => $otherId]);

        $response = $this->getJson('/api/v1/uploads/schedules', $adminHeaders)->assertOk();

        $this->assertGreaterThanOrEqual(2, count($response->json('schedules')));
    }

    public function test_viewer_is_forbidden_from_listing_schedules(): void
    {
        $this->getJson('/api/v1/uploads/schedules', $this->viewerHeaders())->assertStatus(403);
    }

    public function test_reschedule_with_stale_version_returns_409_with_current(): void
    {
        $editorId = $this->editorUserId();
        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'scheduled',
            'version' => 1,
        ]);

        $response = $this->patchJson("/api/v1/uploads/schedules/{$schedule->id}", [
            'scheduledAt' => now()->addHours(2)->toIso8601String(),
            'timeZone' => 'Europe/Istanbul',
            'version' => 99,
        ], $this->editorHeaders())->assertStatus(409);

        $this->assertSame(1, $response->json('current.version'));
    }

    public function test_reschedule_updates_scheduled_at_and_time_zone(): void
    {
        $editorId = $this->editorUserId();
        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'scheduled',
            'version' => 1,
        ]);

        $newTime = now()->addHours(5)->toIso8601String();

        $response = $this->patchJson("/api/v1/uploads/schedules/{$schedule->id}", [
            'scheduledAt' => $newTime,
            'timeZone' => 'Europe/Istanbul',
            'version' => 1,
        ], $this->editorHeaders())->assertOk();

        $this->assertSame(2, $response->json('schedule.version'));
        $this->assertSame('Europe/Istanbul', $response->json('schedule.timeZone'));
    }

    public function test_cancelling_claimed_schedule_conflicts(): void
    {
        $editorId = $this->editorUserId();
        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'claimed',
            'version' => 1,
        ]);

        $this->deleteJson("/api/v1/uploads/schedules/{$schedule->id}", [], $this->editorHeaders())
            ->assertStatus(409);
    }

    public function test_cancel_is_idempotent_for_already_cancelled_schedule(): void
    {
        $editorId = $this->editorUserId();
        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'cancelled',
            'version' => 3,
        ]);

        $this->deleteJson("/api/v1/uploads/schedules/{$schedule->id}", [], $this->editorHeaders())
            ->assertOk()
            ->assertJsonPath('schedule.status', 'cancelled');
    }

    public function test_cancel_scheduled_upload_succeeds(): void
    {
        $editorId = $this->editorUserId();
        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'scheduled',
            'version' => 1,
        ]);

        $this->deleteJson("/api/v1/uploads/schedules/{$schedule->id}", [], $this->editorHeaders())
            ->assertOk()
            ->assertJsonPath('schedule.status', 'cancelled');
    }

    public function test_retry_rejects_non_infrastructure_failure_code(): void
    {
        $editorId = $this->editorUserId();
        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'failed',
            'failure_code' => 'validation_error',
            'version' => 1,
        ]);

        $this->postJson("/api/v1/uploads/schedules/{$schedule->id}/retry", [], $this->editorHeaders())
            ->assertStatus(409);
    }

    public function test_retry_requires_the_staged_artifact_to_still_exist(): void
    {
        $editorId = $this->editorUserId();
        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'failed',
            'failure_code' => 'infrastructure_timeout',
            'disk' => config('ingest.disk'),
            'staged_path' => 'schedules/missing-artifact.mp4',
            'version' => 1,
        ]);

        $this->postJson("/api/v1/uploads/schedules/{$schedule->id}/retry", [], $this->editorHeaders())
            ->assertStatus(409);
    }

    public function test_retry_requeues_infrastructure_failure_with_existing_artifact(): void
    {
        $editorId = $this->editorUserId();
        $disk = config('ingest.disk');
        Storage::disk($disk)->put('schedules/present-artifact.mp4', 'x');

        $schedule = \App\Models\ScheduledUpload::factory()->create([
            'created_by' => $editorId,
            'status' => 'failed',
            'failure_code' => 'infrastructure_timeout',
            'failure_message' => 'Timed out talking to storage.',
            'disk' => $disk,
            'staged_path' => 'schedules/present-artifact.mp4',
            'version' => 1,
        ]);

        $response = $this->postJson("/api/v1/uploads/schedules/{$schedule->id}/retry", [], $this->editorHeaders())
            ->assertOk();

        $response->assertJsonPath('schedule.status', 'scheduled')
            ->assertJsonPath('schedule.version', 2)
            ->assertJsonPath('schedule.failureCode', null);
    }
}
