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

        (new ProcessMediaWorkflow($mediaJob->id))->handle();

        $this->assertDatabaseHas('media_jobs', [
            'id' => $mediaJob->id,
            'status' => 'completed',
        ]);

        $this->assertSame('transcode', $mediaJob->refresh()->result['operation']);
    }
}
