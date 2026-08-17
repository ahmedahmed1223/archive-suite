<?php

namespace Tests\Feature;

use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Models\User;
use App\Services\Media\MediaJobExecutor;
use App\Services\Security\SecuritySettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class MediaJobsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_queues_a_media_workflow_job(): void
    {
        Queue::fake();

        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-1',
            'operation' => 'thumbnail',
            'sourcePath' => 'archive/media-record-1.mov',
            'options' => ['size' => 'large'],
        ], $this->authHeaders())->assertAccepted();

        $jobId = $response->json('job.id');
        $this->assertIsString($jobId);

        $this->assertDatabaseHas('media_jobs', [
            'id' => $jobId,
            'record_id' => 'media-record-1',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'executor' => 'local-v1',
            'contract_version' => 1,
        ]);

        $response
            ->assertJsonPath('job.executor', 'local-v1')
            ->assertJsonPath('job.contractVersion', 1);

        Queue::assertPushed(ProcessMediaWorkflow::class, fn (ProcessMediaWorkflow $job): bool => $job->mediaJobId === $jobId);
    }

    /**
     * V3-PERF-002: the whole point of request tracing is that a caller's
     * X-Request-Id survives past the HTTP boundary into the queued job that
     * request triggered, not just into the HTTP response header.
     */
    public function test_the_callers_request_id_propagates_onto_the_queued_job(): void
    {
        Queue::fake();

        $headers = [...$this->authHeaders(), 'X-Request-Id' => 'trace-e2e-4711'];

        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-trace',
            'operation' => 'thumbnail',
            'sourcePath' => 'archive/media-record-trace.mov',
        ], $headers)->assertAccepted();

        $this->assertSame('trace-e2e-4711', $response->headers->get('X-Request-Id'));

        Queue::assertPushed(
            ProcessMediaWorkflow::class,
            fn (ProcessMediaWorkflow $job): bool => $job->requestId === 'trace-e2e-4711'
        );
    }

    public function test_a_missing_request_id_is_generated_and_still_propagates_onto_the_job(): void
    {
        Queue::fake();

        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-generated-trace',
            'operation' => 'thumbnail',
            'sourcePath' => 'archive/media-record-generated-trace.mov',
        ], $this->authHeaders())->assertAccepted();

        $generatedId = $response->headers->get('X-Request-Id');
        $this->assertNotEmpty($generatedId);

        Queue::assertPushed(
            ProcessMediaWorkflow::class,
            fn (ProcessMediaWorkflow $job): bool => $job->requestId === $generatedId
        );
    }

    /**
     * V3-PERF-005: backpressure. Once a queue already has
     * max_queued_jobs_per_queue rows queued+processing, a new dispatch is
     * rejected (429) instead of growing the backlog further.
     */
    public function test_store_rejects_a_new_job_once_the_queue_is_at_capacity(): void
    {
        Queue::fake();
        config(['media.max_queued_jobs_per_queue' => 2]);

        for ($i = 0; $i < 2; $i++) {
            MediaJob::query()->create([
                'id' => "media-job-capacity-{$i}",
                'record_id' => "media-record-capacity-{$i}",
                'operation' => 'thumbnail',
                'status' => 'queued',
                'queue' => 'default',
                'queued_at' => now(),
            ]);
        }

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-capacity-overflow',
            'operation' => 'thumbnail',
        ], $this->authHeaders())
            ->assertStatus(429)
            ->assertJsonPath('ok', false);

        $this->assertDatabaseMissing('media_jobs', ['record_id' => 'media-record-capacity-overflow']);
        Queue::assertNotPushed(ProcessMediaWorkflow::class);
    }

    public function test_store_still_accepts_a_job_below_capacity(): void
    {
        Queue::fake();
        config(['media.max_queued_jobs_per_queue' => 2]);

        MediaJob::query()->create([
            'id' => 'media-job-capacity-below',
            'record_id' => 'media-record-capacity-below',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queue' => 'default',
            'queued_at' => now(),
        ]);

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-capacity-fits',
            'operation' => 'thumbnail',
        ], $this->authHeaders())->assertAccepted();
    }

    /**
     * The gpu and default queues have independent capacity -- a full default
     * queue must not block a gpu-routed dispatch.
     */
    public function test_capacity_is_tracked_independently_per_queue(): void
    {
        Queue::fake();
        config(['media.max_queued_jobs_per_queue' => 1]);

        MediaJob::query()->create([
            'id' => 'media-job-default-full',
            'record_id' => 'media-record-default-full',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queue' => 'default',
            'queued_at' => now(),
        ]);

        app(SecuritySettingsService::class)->updateWhisperDevice('cuda');

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-gpu-still-fits',
            'operation' => 'transcription',
        ], $this->authHeaders())->assertAccepted();
    }

    public function test_it_reads_queue_status(): void
    {
        MediaJob::query()->create([
            'id' => 'media-job-queue-status-1',
            'record_id' => 'media-record-queue-status-1',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queue' => 'default',
            'queued_at' => now(),
        ]);

        $this->getJson('/api/v1/media/jobs/queue-status', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('status.default', 1)
            ->assertJsonPath('status.gpu', 0)
            ->assertJsonPath('status.resourceFailure', null);
    }

    public function test_cpu_transcriptions_stay_on_the_default_queue(): void
    {
        Queue::fake();

        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-cpu',
            'operation' => 'transcription',
            'sourcePath' => 'archive/media-record-cpu.wav',
        ], $this->authHeaders())->assertAccepted();

        Queue::assertPushedOn('default', ProcessMediaWorkflow::class, fn (ProcessMediaWorkflow $job): bool => $job->mediaJobId === $response->json('job.id'));
    }

    public function test_cuda_transcriptions_are_routed_to_the_gpu_queue(): void
    {
        Queue::fake();
        app(SecuritySettingsService::class)->updateWhisperDevice('cuda');

        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-gpu',
            'operation' => 'transcription',
            'sourcePath' => 'archive/media-record-gpu.wav',
        ], $this->authHeaders())->assertAccepted();

        Queue::assertPushedOn('gpu', ProcessMediaWorkflow::class, fn (ProcessMediaWorkflow $job): bool => $job->mediaJobId === $response->json('job.id'));
    }

    public function test_it_reads_media_workflow_status(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-status-1',
            'record_id' => 'media-record-2',
            'created_by' => $this->authenticatedUserId(),
            'operation' => 'transcription',
            'status' => 'queued',
            'options' => ['language' => 'ar'],
            'queued_at' => now(),
        ]);

        $this->getJson('/api/v1/media/jobs/'.$mediaJob->id, $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('job.id', 'media-job-status-1')
            ->assertJsonPath('job.operation', 'transcription')
            ->assertJsonPath('job.status', 'queued');
    }

    public function test_the_media_workflow_job_marks_work_as_completed(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-process-1',
            'record_id' => 'media-record-3',
            'operation' => 'transcode',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id])->handle(
            $this->app->make(MediaJobExecutor::class)
        );

        $this->assertDatabaseHas('media_jobs', [
            'id' => $mediaJob->id,
            'status' => 'completed',
        ]);

        $this->assertSame('transcode', $mediaJob->refresh()->result['operation']);
    }

    public function test_it_lists_media_jobs(): void
    {
        MediaJob::query()->create([
            'id' => 'media-job-list-1',
            'record_id' => 'media-record-4',
            'created_by' => $this->authenticatedUserId(),
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now()->subMinute(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-list-2',
            'record_id' => 'media-record-5',
            'created_by' => $this->authenticatedUserId(),
            'operation' => 'transcode',
            'status' => 'completed',
            'queued_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/media/jobs', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        $jobs = $response->json('jobs');
        $this->assertCount(2, $jobs);
        $this->assertSame('media-job-list-2', $jobs[0]['id']);
        $this->assertSame('media-job-list-1', $jobs[1]['id']);
    }

    public function test_list_filters_by_status(): void
    {
        MediaJob::query()->create([
            'id' => 'media-job-filter-1',
            'record_id' => 'media-record-6',
            'created_by' => $this->authenticatedUserId(),
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-filter-2',
            'record_id' => 'media-record-7',
            'created_by' => $this->authenticatedUserId(),
            'operation' => 'transcode',
            'status' => 'completed',
            'queued_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/media/jobs?status=queued', $this->authHeaders())
            ->assertOk();

        $jobs = $response->json('jobs');
        $this->assertCount(1, $jobs);
        $this->assertSame('queued', $jobs[0]['status']);
    }

    public function test_list_filters_by_record_id(): void
    {
        MediaJob::query()->create([
            'id' => 'media-job-record-filter-1',
            'record_id' => 'media-record-8',
            'created_by' => $this->authenticatedUserId(),
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-record-filter-2',
            'record_id' => 'media-record-9',
            'created_by' => $this->authenticatedUserId(),
            'operation' => 'transcode',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/media/jobs?recordId=media-record-8', $this->authHeaders())
            ->assertOk();

        $jobs = $response->json('jobs');
        $this->assertCount(1, $jobs);
        $this->assertSame('media-record-8', $jobs[0]['recordId']);
    }

    public function test_list_respects_limit(): void
    {
        for ($i = 0; $i < 5; $i++) {
            MediaJob::query()->create([
                'id' => "media-job-limit-{$i}",
                'record_id' => "media-record-limit-{$i}",
                'created_by' => $this->authenticatedUserId(),
                'operation' => 'thumbnail',
                'status' => 'queued',
                'queued_at' => now()->subMinutes($i),
            ]);
        }

        $response = $this->getJson('/api/v1/media/jobs?limit=2', $this->authHeaders())
            ->assertOk();

        $jobs = $response->json('jobs');
        $this->assertCount(2, $jobs);
    }

    public function test_list_caps_limit_at_100(): void
    {
        $response = $this->getJson('/api/v1/media/jobs?limit=500', $this->authHeaders())
            ->assertOk();

        $this->assertLessThanOrEqual(100, count($response->json('jobs')));
    }

    public function test_list_signals_more_jobs_exist_beyond_the_page_limit(): void
    {
        $userId = $this->authenticatedUserId();

        for ($i = 0; $i < 4; $i++) {
            MediaJob::query()->create([
                'id' => "media-job-more-{$i}",
                'record_id' => "media-record-more-{$i}",
                'created_by' => $userId,
                'operation' => 'thumbnail',
                'status' => 'queued',
                'queued_at' => now()->addSeconds($i),
            ]);
        }

        $response = $this->getJson('/api/v1/media/jobs?limit=3', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('pagination.total', 4)
            ->assertJsonPath('pagination.limit', 3)
            ->assertJsonPath('pagination.page', 1)
            ->assertJsonPath('pagination.hasMore', true);

        $this->assertCount(3, $response->json('jobs'));
    }

    public function test_list_requires_authentication(): void
    {
        $this->getJson('/api/v1/media/jobs')
            ->assertUnauthorized();
    }

    public function test_workflow_job_produces_thumbnail_artifacts(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-thumb-artifact',
            'record_id' => 'media-record-thumb',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id])->handle(
            $this->app->make(MediaJobExecutor::class)
        );

        $refreshed = $mediaJob->refresh();
        $this->assertSame('completed', $refreshed->status);
        $this->assertIsArray($refreshed->result['artifacts']);
        $this->assertNotEmpty($refreshed->result['artifacts']);
        $this->assertSame('thumbnail', $refreshed->result['artifacts'][0]['kind']);
    }

    public function test_workflow_job_produces_transcription_artifacts(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-transcript-artifact',
            'record_id' => 'media-record-transcript',
            'operation' => 'transcription',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id])->handle(
            $this->app->make(MediaJobExecutor::class)
        );

        $refreshed = $mediaJob->refresh();
        $this->assertSame('completed', $refreshed->status);
        $this->assertIsArray($refreshed->result['artifacts']);
        $this->assertNotEmpty($refreshed->result['artifacts']);
        $kinds = array_column($refreshed->result['artifacts'], 'kind');
        $this->assertContains('transcript_srt', $kinds);
    }

    public function test_store_rejects_invalid_operation(): void
    {
        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-invalid',
            'operation' => 'invalid_operation',
        ], $this->authHeaders())
            ->assertUnprocessable();
    }

    public function test_store_accepts_ocr_operation(): void
    {
        Queue::fake();

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-ocr',
            'operation' => 'ocr',
            'sourcePath' => 'archive/media-record-ocr.jpg',
        ], $this->authHeaders())->assertAccepted();

        $this->assertDatabaseHas('media_jobs', [
            'record_id' => 'media-record-ocr',
            'operation' => 'ocr',
            'status' => 'queued',
        ]);
    }

    public function test_store_accepts_montage_export_operation(): void
    {
        Queue::fake();

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-montage',
            'operation' => 'montage_export',
            'options' => [
                'clips' => [
                    ['path' => 'archive/clip-a.mp4', 'inSec' => 0, 'outSec' => 5],
                ],
            ],
        ], $this->authHeaders())->assertAccepted();

        $this->assertDatabaseHas('media_jobs', [
            'record_id' => 'media-record-montage',
            'operation' => 'montage_export',
            'status' => 'queued',
        ]);
    }

    public function test_workflow_job_produces_montage_export_artifacts(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-montage-artifact',
            'record_id' => 'media-record-montage-artifact',
            'operation' => 'montage_export',
            'status' => 'queued',
            'options' => [
                'clips' => [
                    ['path' => 'archive/clip-a.mp4', 'inSec' => 0, 'outSec' => 5],
                ],
            ],
            'queued_at' => now(),
        ]);

        $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id])->handle(
            $this->app->make(MediaJobExecutor::class)
        );

        $refreshed = $mediaJob->refresh();
        $this->assertSame('completed', $refreshed->status);
        $this->assertIsArray($refreshed->result['artifacts']);
        $this->assertNotEmpty($refreshed->result['artifacts']);
        $this->assertSame('montage_mp4', $refreshed->result['artifacts'][0]['kind']);
    }

    public function test_workflow_job_produces_ocr_artifacts(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-ocr-artifact',
            'record_id' => 'media-record-ocr-artifact',
            'operation' => 'ocr',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id])->handle(
            $this->app->make(MediaJobExecutor::class)
        );

        $refreshed = $mediaJob->refresh();
        $this->assertSame('completed', $refreshed->status);
        $this->assertIsArray($refreshed->result['artifacts']);
        $this->assertNotEmpty($refreshed->result['artifacts']);
        $this->assertSame('ocr_text', $refreshed->result['artifacts'][0]['kind']);
    }

    /**
     * Id of the default authHeaders() test user, for tests that create a
     * MediaJob directly (bypassing store()) and then exercise ownership-scoped
     * endpoints (index/show/cancel) as that same user.
     */
    private function authenticatedUserId(): string
    {
        $this->authHeaders();

        return (string) User::query()->where('email', 'admin@example.test')->firstOrFail()->getKey();
    }
}
