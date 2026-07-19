<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1-711: resumable chunked upload. Chunks are sent as raw request bodies
 * (PUT, application/octet-stream) — Laravel's test client's `put()` helper
 * sends JSON by default, so raw-body chunk requests go through `call()`
 * directly with the bytes as the request content.
 */
class ChunkedUploadTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('ingest.disk'));
        // Production's 256KB floor exists to bound request-count on huge
        // files; tests use tiny fixtures for speed and need a lower floor.
        config(['ingest.chunk_upload.min_chunk_bytes' => 1]);
    }

    private function putChunk(string $sessionId, int $index, string $bytes): \Illuminate\Testing\TestResponse
    {
        return $this->call(
            'PUT',
            "/api/v1/uploads/sessions/{$sessionId}/chunks/{$index}",
            [],
            [],
            [],
            array_merge($this->transformHeadersToServerVars($this->authHeaders()), [
                'CONTENT_TYPE' => 'application/octet-stream',
            ]),
            $bytes,
        );
    }

    private function createSession(array $overrides = []): array
    {
        $response = $this->postJson('/api/v1/uploads/sessions', array_merge([
            'fileName' => 'movie.mp4',
            'totalSize' => 30,
            'chunkSize' => 10,
        ], $overrides), $this->authHeaders())->assertCreated();

        return $response->json('session');
    }

    public function test_it_creates_a_session_with_computed_total_chunks(): void
    {
        $session = $this->createSession();

        $this->assertSame(3, $session['totalChunks']);
        $this->assertSame([], $session['receivedChunks']);
        $this->assertSame('pending', $session['status']);
        $this->assertDatabaseHas('upload_sessions', ['id' => $session['id'], 'status' => 'pending']);
    }

    public function test_it_accepts_chunks_out_of_order_and_reports_resume_state(): void
    {
        $session = $this->createSession();
        $id = $session['id'];

        $this->putChunk($id, 2, str_repeat('c', 10))
            ->assertOk()
            ->assertJsonPath('receivedChunks', [2]);

        $this->putChunk($id, 0, str_repeat('a', 10))
            ->assertOk()
            ->assertJsonPath('receivedChunks', [0, 2]);

        // The resume endpoint — a reconnecting client learns index 1 is missing.
        $status = $this->getJson("/api/v1/uploads/sessions/{$id}", $this->authHeaders())
            ->assertOk()
            ->json('session');
        $this->assertSame([0, 2], $status['receivedChunks']);
    }

    public function test_it_ignores_a_duplicate_re_upload_of_the_same_chunk_index(): void
    {
        $session = $this->createSession();
        $id = $session['id'];

        $this->putChunk($id, 0, str_repeat('a', 10))->assertOk();
        $this->putChunk($id, 0, str_repeat('a', 10))->assertOk()->assertJsonPath('receivedChunks', [0]);
    }

    public function test_it_rejects_a_chunk_index_out_of_range(): void
    {
        $session = $this->createSession();

        $this->putChunk($session['id'], 5, str_repeat('a', 10))
            ->assertStatus(422)
            ->assertJsonPath('code', 'invalid_chunk_index');
    }

    public function test_it_rejects_a_chunk_with_the_wrong_byte_count(): void
    {
        $session = $this->createSession();

        $this->putChunk($session['id'], 0, str_repeat('a', 3))
            ->assertStatus(422)
            ->assertJsonPath('code', 'chunk_size_mismatch');
    }

    public function test_complete_reports_missing_chunks_when_incomplete(): void
    {
        $session = $this->createSession();
        $this->putChunk($session['id'], 0, str_repeat('a', 10))->assertOk();

        $this->postJson("/api/v1/uploads/sessions/{$session['id']}/complete", [], $this->authHeaders())
            ->assertStatus(409)
            ->assertJsonPath('code', 'incomplete_upload')
            ->assertJsonPath('missingChunks', [1, 2]);
    }

    public function test_complete_assembles_chunks_in_order_and_creates_an_archive_record(): void
    {
        Queue::fake();

        // Real MP4 header so content-sniffing accepts it, padded to a clean
        // multiple of the chunk size for a simple, evenly-split test fixture.
        $header = "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom\x00\x00\x00\x00\x00\x00\x00\x00";
        $chunkSize = 10;
        $remainder = strlen($header) % $chunkSize;
        $content = $header.($remainder === 0 ? '' : str_repeat('x', $chunkSize - $remainder));
        $chunks = str_split($content, $chunkSize);
        $totalSize = strlen($content);

        $session = $this->createSession([
            'fileName' => 'clip.mp4',
            'totalSize' => $totalSize,
            'chunkSize' => $chunkSize,
            'checksum' => hash('sha256', $content),
        ]);

        foreach ($chunks as $index => $chunk) {
            $this->putChunk($session['id'], $index, $chunk)->assertOk();
        }

        $response = $this->postJson("/api/v1/uploads/sessions/{$session['id']}/complete", [], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true);

        $recordId = $response->json('record.id');
        $this->assertSame('clip.mp4', $response->json('record.fileName'));
        $this->assertSame(hash('sha256', $content), $response->json('record.checksum'));

        $this->assertDatabaseHas('storage_rows', ['store' => 'archive-items', 'uid' => $recordId]);
        $this->assertDatabaseHas('upload_sessions', ['id' => $session['id'], 'status' => 'completed']);

        $storedPath = $response->json('record.filePath');
        Storage::disk(config('ingest.disk'))->assertExists($storedPath);
        $this->assertSame($content, Storage::disk(config('ingest.disk'))->get($storedPath));

        // Chunks are cleaned up after a successful assembly.
        Storage::disk(config('ingest.disk'))->assertDirectoryEmpty(
            trim((string) config('ingest.directory'), '/')."/quarantine/sessions/{$session['id']}"
        );
    }

    public function test_complete_rejects_a_checksum_mismatch_and_aborts_the_session(): void
    {
        $session = $this->createSession([
            'totalSize' => 10,
            'chunkSize' => 10,
            'checksum' => str_repeat('0', 64),
        ]);
        $this->putChunk($session['id'], 0, str_repeat('a', 10))->assertOk();

        $this->postJson("/api/v1/uploads/sessions/{$session['id']}/complete", [], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('code', 'checksum_mismatch');

        $this->assertDatabaseHas('upload_sessions', ['id' => $session['id'], 'status' => 'aborted']);
    }

    public function test_complete_rejects_unsafe_content_disguised_with_an_allowed_extension(): void
    {
        $script = "<?php system(\$_GET['c']); ?>".str_repeat("\n", 20);
        $session = $this->createSession([
            'fileName' => 'photo.jpg',
            'totalSize' => strlen($script),
            'chunkSize' => strlen($script),
        ]);
        $this->putChunk($session['id'], 0, $script)->assertOk();

        $this->postJson("/api/v1/uploads/sessions/{$session['id']}/complete", [], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('code', 'unsafe_file_content');

        $this->assertDatabaseHas('upload_sessions', ['id' => $session['id'], 'status' => 'aborted']);
    }

    public function test_a_completed_session_cannot_receive_further_chunks(): void
    {
        $header = "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom\x00\x00\x00\x00\x00\x00\x00\x00";
        $session = $this->createSession([
            'fileName' => 'clip.mp4',
            'totalSize' => strlen($header),
            'chunkSize' => strlen($header),
        ]);
        Queue::fake();
        $this->putChunk($session['id'], 0, $header)->assertOk();
        $this->postJson("/api/v1/uploads/sessions/{$session['id']}/complete", [], $this->authHeaders())->assertCreated();

        $this->putChunk($session['id'], 0, $header)->assertStatus(410)->assertJsonPath('code', 'session_inactive');
    }

    public function test_abort_deletes_the_session_and_its_chunks(): void
    {
        $session = $this->createSession();
        $this->putChunk($session['id'], 0, str_repeat('a', 10))->assertOk();

        $this->deleteJson("/api/v1/uploads/sessions/{$session['id']}", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->assertDatabaseMissing('upload_sessions', ['id' => $session['id']]);
        Storage::disk(config('ingest.disk'))->assertMissing(
            trim((string) config('ingest.directory'), '/')."/quarantine/sessions/{$session['id']}/0"
        );
    }

    public function test_unknown_session_id_returns_404_on_every_action(): void
    {
        $missing = '00000000-0000-0000-0000-000000000000';

        $this->getJson("/api/v1/uploads/sessions/{$missing}", $this->authHeaders())->assertStatus(404);
        $this->putChunk($missing, 0, 'x')->assertStatus(404);
        $this->postJson("/api/v1/uploads/sessions/{$missing}/complete", [], $this->authHeaders())->assertStatus(404);
        $this->deleteJson("/api/v1/uploads/sessions/{$missing}", [], $this->authHeaders())->assertStatus(404);
    }

    public function test_an_expired_session_is_rejected_and_marked_aborted(): void
    {
        $session = $this->createSession();
        DB::table('upload_sessions')->where('id', $session['id'])->update(['expires_at' => now()->subMinute()]);

        $this->putChunk($session['id'], 0, str_repeat('a', 10))
            ->assertStatus(410)
            ->assertJsonPath('code', 'session_inactive');

        $this->assertDatabaseHas('upload_sessions', ['id' => $session['id'], 'status' => 'aborted']);
    }

    public function test_it_rejects_session_creation_when_free_disk_space_is_below_the_configured_margin(): void
    {
        config(['ingest.min_free_bytes' => PHP_INT_MAX]);

        $this->postJson('/api/v1/uploads/sessions', [
            'fileName' => 'movie.mp4',
            'totalSize' => 30,
            'chunkSize' => 10,
        ], $this->authHeaders())
            ->assertStatus(507)
            ->assertJsonPath('code', 'insufficient_disk_space');
    }

    public function test_it_requires_authentication(): void
    {
        $this->postJson('/api/v1/uploads/sessions', [
            'fileName' => 'movie.mp4',
            'totalSize' => 30,
            'chunkSize' => 10,
        ])->assertUnauthorized();
    }
}
