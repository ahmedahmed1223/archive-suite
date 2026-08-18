<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V3-MEDIA-006: cached, version-pinned thumbnail/waveform/proxy derivatives.
 * QUEUE_CONNECTION=sync in phpunit.xml means dispatch() below actually runs
 * ProcessMediaWorkflow inline within the same request unless Queue::fake()
 * intercepts it -- tests that want to inspect a still-in-flight/rejected
 * state use Queue::fake(); tests that want to see the finished lifecycle
 * (using the default fake MediaProcessor, config('media.processor')=fake in
 * tests) let it run for real.
 */
class MediaDerivativesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_requests_and_synchronously_generates_a_derivative(): void
    {
        $this->seedRecord('record-1', 'checksum-1');

        $response = $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-1',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/record-1.mov',
            'settings' => ['atSec' => 2],
        ], $this->authHeaders())->assertStatus(202);

        $response
            ->assertJsonPath('ok', true)
            ->assertJsonPath('cached', false)
            ->assertJsonPath('derivative.recordUid', 'record-1')
            ->assertJsonPath('derivative.derivativeType', 'thumbnail')
            ->assertJsonPath('derivative.versionToken', 'record:checksum-1')
            ->assertJsonPath('derivative.isCurrentVersion', true)
            ->assertJsonPath('derivative.status', 'ready')
            ->assertJsonPath('derivative.storageKey', 'record-1/derivatives/'.$response->json('derivative.id').'.jpg');

        $this->assertDatabaseHas('media_derivatives', [
            'id' => $response->json('derivative.id'),
            'record_uid' => 'record-1',
            'derivative_type' => 'thumbnail',
            'status' => 'ready',
        ]);
    }

    public function test_a_second_identical_request_returns_the_cached_derivative_without_dispatching_again(): void
    {
        $this->seedRecord('record-2', 'checksum-2');

        $first = $this->requestDerivative('record-2', 'thumbnail', ['atSec' => 1]);
        $firstId = $first->json('derivative.id');

        Queue::fake();

        $second = $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-2',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/record-2.mov',
            'settings' => ['atSec' => 1],
        ], $this->authHeaders())->assertOk();

        $second->assertJsonPath('cached', true)->assertJsonPath('derivative.id', $firstId);
        Queue::assertNotPushed(ProcessMediaWorkflow::class);
    }

    public function test_different_settings_produce_independent_derivatives(): void
    {
        $this->seedRecord('record-3', 'checksum-3');

        $a = $this->requestDerivative('record-3', 'thumbnail', ['atSec' => 1]);
        $b = $this->requestDerivative('record-3', 'thumbnail', ['atSec' => 9]);

        $this->assertNotSame($a->json('derivative.id'), $b->json('derivative.id'));
        $this->assertSame(2, DB::table('media_derivatives')->where('record_uid', 'record-3')->count());
    }

    public function test_settings_key_order_does_not_defeat_the_cache(): void
    {
        $this->seedRecord('record-3b', 'checksum-3b');

        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-3b',
            'type' => 'proxy',
            'sourcePath' => 'archive/record-3b.mov',
            'settings' => ['maxWidth' => 480, 'videoBitrateKbps' => 800],
        ], $this->authHeaders())->assertStatus(202);

        Queue::fake();

        $reordered = $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-3b',
            'type' => 'proxy',
            'sourcePath' => 'archive/record-3b.mov',
            'settings' => ['videoBitrateKbps' => 800, 'maxWidth' => 480],
        ], $this->authHeaders())->assertOk();

        $reordered->assertJsonPath('cached', true);
        Queue::assertNotPushed(ProcessMediaWorkflow::class);
    }

    public function test_replacing_the_source_makes_a_ready_derivative_report_stale_but_keeps_it_and_a_fresh_request_creates_a_new_one(): void
    {
        $disk = config('ingest.disk');
        Storage::fake($disk);
        Storage::disk($disk)->put('ingest/uploads/original.txt', 'original');
        $this->seedRecord('record-4', hash('sha256', 'original'), 'ingest/uploads/original.txt', 'original.txt');

        $ready = $this->requestDerivative('record-4', 'thumbnail', ['atSec' => 0]);
        $readyId = $ready->json('derivative.id');

        $this->post('/api/v1/records/record-4/source-replacements', [
            'file' => UploadedFile::fake()->createWithContent('replacement.txt', 'replacement'),
        ], $this->authHeaders())->assertOk();

        $stale = $this->getJson("/api/v1/media-derivatives/{$readyId}", $this->authHeaders())->assertOk();
        $this->assertFalse($stale->json('derivative.isCurrentVersion'));
        $this->assertSame('ready', $stale->json('derivative.status'));
        // Never silently served as current -- but not deleted either.
        $this->assertNotNull($stale->json('derivative.storageKey'));

        $fresh = $this->requestDerivative('record-4', 'thumbnail', ['atSec' => 0]);
        $this->assertNotSame($readyId, $fresh->json('derivative.id'));
        $this->assertTrue($fresh->json('derivative.isCurrentVersion'));

        // The derivative pipeline never touches the source media itself.
        $this->assertTrue(Storage::disk($disk)->exists('ingest/uploads/original.txt'));
    }

    public function test_a_rejected_request_can_be_retried_once_capacity_frees_up(): void
    {
        $this->seedRecord('record-5', 'checksum-5');
        Queue::fake();
        config(['media.max_queued_jobs_per_queue' => 1]);

        MediaJob::query()->create([
            'id' => 'media-job-derivative-capacity',
            'record_id' => 'record-5',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queue' => 'default',
            'queued_at' => now(),
        ]);

        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-5',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/record-5.mov',
        ], $this->authHeaders())
            ->assertStatus(429)
            ->assertJsonPath('ok', false);

        // The rejected request must not have left an orphaned row behind
        // that a later identical request would mistake for "already in
        // flight" and never actually retry.
        $this->assertSame(0, DB::table('media_derivatives')->where('record_uid', 'record-5')->count());

        MediaJob::query()->where('id', 'media-job-derivative-capacity')->update(['status' => 'completed']);
        Queue::fake();

        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-5',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/record-5.mov',
        ], $this->authHeaders())->assertStatus(202);

        Queue::assertPushed(ProcessMediaWorkflow::class);
    }

    public function test_viewer_cannot_request_a_derivative(): void
    {
        $this->seedRecord('record-6', 'checksum-6');

        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-6',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/record-6.mov',
        ], $this->viewerHeaders())->assertForbidden();

        $this->assertSame(0, DB::table('media_derivatives')->count());
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-7',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/record-7.mov',
        ])->assertUnauthorized();
    }

    public function test_missing_record_returns_not_found(): void
    {
        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'missing-record',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/x.mov',
        ], $this->authHeaders())->assertNotFound();
    }

    public function test_missing_derivative_returns_not_found(): void
    {
        $this->getJson('/api/v1/media-derivatives/does-not-exist', $this->authHeaders())->assertNotFound();
    }

    public function test_rejects_traversal_in_source_path(): void
    {
        $this->seedRecord('record-8', 'checksum-8');

        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-8',
            'type' => 'thumbnail',
            'sourcePath' => '../../etc/passwd',
        ], $this->authHeaders())->assertStatus(422);
    }

    public function test_rejects_unknown_derivative_type(): void
    {
        $this->seedRecord('record-9', 'checksum-9');

        $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-9',
            'type' => 'not-a-real-type',
            'sourcePath' => 'archive/record-9.mov',
        ], $this->authHeaders())->assertStatus(422);
    }

    public function test_index_lists_derivatives_for_a_record_and_can_filter_by_type(): void
    {
        $this->seedRecord('record-10', 'checksum-10');
        $this->requestDerivative('record-10', 'thumbnail', ['atSec' => 0]);
        $this->requestDerivative('record-10', 'waveform', []);

        $this->getJson('/api/v1/records/record-10/media-derivatives', $this->authHeaders())
            ->assertOk()->assertJsonCount(2, 'derivatives');

        $this->getJson('/api/v1/records/record-10/media-derivatives?type=waveform', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'derivatives')
            ->assertJsonPath('derivatives.0.derivativeType', 'waveform');
    }

    public function test_a_failed_generation_can_be_retried_against_the_same_cache_key(): void
    {
        $this->seedRecord('record-11', 'checksum-11');

        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-derivative-preexisting',
            'record_id' => 'record-11',
            'operation' => 'derivative',
            'status' => 'queued',
            'queue' => 'default',
            'source_path' => 'archive/record-11.mov',
            'options' => ['derivativeId' => 'seed-derivative-11', 'derivativeType' => 'thumbnail', 'settings' => []],
            'queued_at' => now(),
        ]);

        DB::table('media_derivatives')->insert([
            'id' => 'seed-derivative-11',
            'record_store' => 'archive-items',
            'record_uid' => 'record-11',
            'attachment_id' => null,
            'derivative_type' => 'thumbnail',
            'version_token' => 'record:checksum-11',
            'settings' => json_encode([]),
            'settings_hash' => hash('sha256', json_encode([])),
            'status' => 'failed',
            'storage_key' => null,
            'media_job_id' => $mediaJob->id,
            'error' => 'ffmpeg derivative thumbnail failed: boom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $retried = $this->postJson('/api/v1/media-derivatives', [
            'recordId' => 'record-11',
            'type' => 'thumbnail',
            'sourcePath' => 'archive/record-11.mov',
            'settings' => [],
        ], $this->authHeaders())->assertStatus(202);

        $retried->assertJsonPath('cached', false)
            ->assertJsonPath('derivative.id', 'seed-derivative-11')
            ->assertJsonPath('derivative.status', 'ready')
            ->assertJsonPath('derivative.error', null);
    }

    private function seedRecord(string $uid, string $checksum, ?string $filePath = null, ?string $fileName = null): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode([
                'id' => $uid,
                'title' => 'Media derivative fixture',
                'checksum' => $checksum,
                'filePath' => $filePath,
                'fileName' => $fileName,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function requestDerivative(string $recordId, string $type, array $settings): TestResponse
    {
        return $this->postJson('/api/v1/media-derivatives', [
            'recordId' => $recordId,
            'type' => $type,
            'sourcePath' => "archive/{$recordId}.mov",
            'settings' => $settings,
        ], $this->authHeaders())->assertStatus(202);
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Derivative Viewer',
            'email' => 'derivative-viewer@example.test',
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
