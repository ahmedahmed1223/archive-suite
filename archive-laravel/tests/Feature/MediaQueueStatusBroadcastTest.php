<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Events\MediaQueueStatusUpdated;
use App\Exceptions\GpuUnavailableException;
use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Services\Media\MediaJobExecutor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * RT-802: queuing a job (and any subsequent status transition, via
 * MediaJobProgressBroadcaster) broadcasts aggregate CPU/GPU queue counts on
 * the shared media-queue-status channel — never per-job data. A GPU
 * resource failure additionally carries a resourceFailure message,
 * distinguished from an ordinary job failure via GpuUnavailableException
 * (see CudaCapabilityChecker::assertAvailable()).
 */
class MediaQueueStatusBroadcastTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_queuing_a_job_broadcasts_aggregate_queue_counts(): void
    {
        Queue::fake();
        Event::fake([MediaQueueStatusUpdated::class]);

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-queue-1',
            'operation' => 'thumbnail',
        ], $this->authHeaders())->assertAccepted();

        Event::assertDispatched(MediaQueueStatusUpdated::class, function (MediaQueueStatusUpdated $event): bool {
            return $event->status['default'] === 1
                && $event->status['gpu'] === 0
                && in_array('private-media-queue-status', array_map(
                    fn ($channel) => $channel->name,
                    $event->broadcastOn()
                ), true);
        });
    }

    public function test_gpu_resource_failure_broadcasts_the_failure_message(): void
    {
        Event::fake([MediaQueueStatusUpdated::class]);

        $job = MediaJob::query()->create([
            'id' => 'gpu-fail-job-1',
            'record_id' => 'media-record-gpu-1',
            'operation' => 'transcription',
            'status' => 'queued',
            'queue' => 'gpu',
            'options' => [],
            'queued_at' => now(),
        ]);

        $failingExecutor = new class implements MediaJobExecutor
        {
            public function name(): string
            {
                return 'fake-gpu';
            }

            public function execute(MediaJob $job): array
            {
                throw new GpuUnavailableException('CUDA transcription requires a GPU worker with the NVIDIA runtime and a visible GPU.');
            }
        };

        try {
            (new ProcessMediaWorkflow($job->id))->handle($failingExecutor);
        } catch (GpuUnavailableException) {
            // Expected — handle() rethrows so Laravel's queue can retry/fail it.
        }

        Event::assertDispatched(MediaQueueStatusUpdated::class, function (MediaQueueStatusUpdated $event): bool {
            return $event->status['resourceFailure'] !== null
                && str_contains($event->status['resourceFailure'], 'GPU worker');
        });
    }
}
