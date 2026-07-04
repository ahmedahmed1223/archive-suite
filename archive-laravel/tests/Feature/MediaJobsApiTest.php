<?php

namespace Tests\Feature;

use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class MediaJobsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

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
        ]);

        Queue::assertPushed(ProcessMediaWorkflow::class, fn (ProcessMediaWorkflow $job): bool => $job->mediaJobId === $jobId);
    }

    public function test_it_reads_media_workflow_status(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-status-1',
            'record_id' => 'media-record-2',
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
            $this->app->make(\App\Services\Media\MediaProcessor::class)
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
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now()->subMinute(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-list-2',
            'record_id' => 'media-record-5',
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
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-filter-2',
            'record_id' => 'media-record-7',
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

    public function test_list_filters_by_recordId(): void
    {
        MediaJob::query()->create([
            'id' => 'media-job-record-filter-1',
            'record_id' => 'media-record-8',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-record-filter-2',
            'record_id' => 'media-record-9',
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
            $this->app->make(\App\Services\Media\MediaProcessor::class)
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
            $this->app->make(\App\Services\Media\MediaProcessor::class)
        );

        $refreshed = $mediaJob->refresh();
        $this->assertSame('completed', $refreshed->status);
        $this->assertIsArray($refreshed->result['artifacts']);
        $this->assertNotEmpty($refreshed->result['artifacts']);
        $this->assertSame('transcript', $refreshed->result['artifacts'][0]['kind']);
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
            $this->app->make(\App\Services\Media\MediaProcessor::class)
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
            $this->app->make(\App\Services\Media\MediaProcessor::class)
        );

        $refreshed = $mediaJob->refresh();
        $this->assertSame('completed', $refreshed->status);
        $this->assertIsArray($refreshed->result['artifacts']);
        $this->assertNotEmpty($refreshed->result['artifacts']);
        $this->assertSame('ocr_text', $refreshed->result['artifacts'][0]['kind']);
    }
}
