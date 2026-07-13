<?php

namespace Tests\Feature;

use App\Exceptions\JobCanceledException;
use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Services\Media\AudioPreprocessor;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\MediaPathGuard;
use App\Services\Media\MediaProcessor;
use App\Services\Media\OcrClient;
use App\Services\Media\ProcessRunner;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\WhisperTranscriber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

/**
 * V1-113: real timeouts/backoff/idempotency/cancel for ProcessMediaWorkflow,
 * plus sanitized error surfaces. V1-111 (containment/ownership) is covered
 * separately by MediaJobsContainmentTest and is not re-tested here.
 */
class MediaJobsReliabilityTest extends TestCase
{
    use RefreshDatabase;

    // -- timeouts / tries / backoff -------------------------------------

    public function test_job_has_a_bounded_timeout_and_retry_policy(): void
    {
        $job = new ProcessMediaWorkflow('job-config-1');

        $this->assertGreaterThan(0, $job->timeout);
        $this->assertGreaterThan(1, $job->tries);
        $this->assertNotEmpty($job->backoff());

        foreach ($job->backoff() as $seconds) {
            $this->assertIsInt($seconds);
        }
    }

    public function test_job_declares_a_without_overlapping_middleware(): void
    {
        $job = new ProcessMediaWorkflow('job-config-2');
        $middleware = $job->middleware();

        $this->assertCount(1, $middleware);
        $this->assertInstanceOf(WithoutOverlapping::class, $middleware[0]);
    }

    // -- idempotency: duplicate dispatch is deduped ----------------------

    public function test_duplicate_dispatch_for_the_same_job_id_is_deduped(): void
    {
        Queue::fake();

        ProcessMediaWorkflow::dispatch('duplicate-job-id');
        ProcessMediaWorkflow::dispatch('duplicate-job-id');

        Queue::assertPushedOnce(ProcessMediaWorkflow::class);
    }

    public function test_dispatch_for_different_job_ids_is_not_deduped(): void
    {
        Queue::fake();

        ProcessMediaWorkflow::dispatch('distinct-job-id-1');
        ProcessMediaWorkflow::dispatch('distinct-job-id-2');

        Queue::assertPushedTimes(ProcessMediaWorkflow::class, 2);
    }

    // -- cancel: real, not just a DB flag ---------------------------------

    public function test_handle_skips_processing_entirely_for_an_already_canceled_job(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'canceled-before-start',
            'record_id' => 'record-1',
            'operation' => 'thumbnail',
            'status' => 'canceled',
            'queued_at' => now(),
        ]);

        $this->mock(MediaProcessor::class, function ($mock): void {
            $mock->shouldNotReceive('process');
        });

        $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id])
            ->handle($this->app->make(MediaProcessor::class));

        $this->assertSame('canceled', $mediaJob->refresh()->status);
    }

    public function test_processor_refuses_to_run_a_canceled_job(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'canceled-in-processor',
            'record_id' => 'record-2',
            'operation' => 'thumbnail',
            'status' => 'canceled',
            'source_path' => 'archive/source.mov',
            'options' => [],
            'queued_at' => now(),
        ]);

        $runner = new FakeProcessRunner();
        $processor = $this->realProcessor($runner);

        $this->expectException(JobCanceledException::class);

        try {
            $processor->process($mediaJob);
        } finally {
            $this->assertSame([], $runner->lastCommand());
        }
    }

    public function test_transcription_stops_at_the_next_segment_checkpoint_once_canceled(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'canceled-mid-transcription',
            'record_id' => 'record-3',
            'operation' => 'transcription',
            'status' => 'processing',
            'source_path' => 'archive/source.mov',
            'options' => ['outputFormats' => ['vtt']],
            'queued_at' => now(),
        ]);

        $runner = new FakeProcessRunner();
        $preprocessor = new class($mediaJob, $runner) extends AudioPreprocessor {
            public int $extractSegmentCalls = 0;

            public function __construct(private readonly MediaJob $job, ProcessRunner $runner)
            {
                parent::__construct($runner);
            }

            public function extractAudio(string $sourcePath, string $recordId): string
            {
                return 'fake-audio.wav';
            }

            public function planSegments(string $audioPath): array
            {
                return [
                    ['startSec' => 0, 'endSec' => 10, 'durationSec' => 10],
                    ['startSec' => 10, 'endSec' => 20, 'durationSec' => 10],
                    ['startSec' => 20, 'endSec' => 30, 'durationSec' => 10],
                ];
            }

            public function extractSegment(string $audioPath, string $recordId, int $segmentIndex, float $startSec, float $endSec): string
            {
                $this->extractSegmentCalls++;

                // Simulate the user hitting cancel while segment 0 was being
                // transcribed: by the time the loop reaches segment 1, the
                // job's DB row is already 'canceled'.
                if ($segmentIndex === 0) {
                    MediaJob::query()->whereKey($this->job->id)->update(['status' => 'canceled']);
                }

                return "fake-segment-{$segmentIndex}.wav";
            }
        };

        $processor = $this->realProcessor($runner, $preprocessor);

        try {
            $processor->process($mediaJob);
            $this->fail('Expected JobCanceledException.');
        } catch (JobCanceledException) {
            // expected
        }

        $this->assertSame(1, $preprocessor->extractSegmentCalls);
        $this->assertSame('canceled', $mediaJob->refresh()->status);
    }

    public function test_cancel_exception_leaves_job_canceled_without_marking_it_failed(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'cancel-exception-flow',
            'record_id' => 'record-4',
            'operation' => 'thumbnail',
            'status' => 'canceled',
            'queued_at' => now(),
        ]);

        $this->mock(MediaProcessor::class, function ($mock) use ($mediaJob): void {
            $mock->shouldNotReceive('process');
        });

        $job = $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id]);
        $job->handle($this->app->make(MediaProcessor::class));

        $this->assertSame('canceled', $mediaJob->refresh()->status);
        $this->assertNull($mediaJob->error);
    }

    // -- error sanitization: no raw filesystem paths in job-facing errors --

    public function test_failed_attempt_error_is_sanitized_of_filesystem_paths(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'sanitize-error-job',
            'record_id' => 'record-5',
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $leakyMessage = 'ffmpeg failed: /var/www/archive-laravel/storage/app/archive-files/record-5/source.mov: No such file';

        $this->mock(MediaProcessor::class, function ($mock) use ($leakyMessage): void {
            $mock->shouldReceive('process')->once()->andThrow(new RuntimeException($leakyMessage));
        });

        $job = $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id]);

        try {
            $job->handle($this->app->make(MediaProcessor::class));
            $this->fail('Expected the underlying exception to propagate for queue retry.');
        } catch (RuntimeException) {
            // expected — handle() rethrows so Laravel's retry/backoff can act.
        }

        $storedError = $mediaJob->refresh()->error;
        $this->assertIsString($storedError);
        $this->assertStringNotContainsString('/var/www', $storedError);
        $this->assertStringNotContainsString('archive-files', $storedError);
        $this->assertStringContainsString('[path]', $storedError);
    }

    public function test_failed_method_marks_job_failed_only_after_retries_are_exhausted(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'exhausted-retries-job',
            'record_id' => 'record-6',
            'operation' => 'thumbnail',
            'status' => 'processing',
            'queued_at' => now(),
            'started_at' => now(),
        ]);

        $job = $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id]);
        $job->failed(new RuntimeException('/etc/some/leaked/path failed permanently'));

        $refreshed = $mediaJob->refresh();
        $this->assertSame('failed', $refreshed->status);
        $this->assertNotNull($refreshed->completed_at);
        $this->assertStringNotContainsString('/etc/some/leaked/path', (string) $refreshed->error);
    }

    public function test_failed_method_does_not_override_a_cancellation(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'canceled-then-failed-callback',
            'record_id' => 'record-7',
            'operation' => 'thumbnail',
            'status' => 'canceled',
            'queued_at' => now(),
            'completed_at' => now(),
        ]);

        $job = $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id]);
        $job->failed(new RuntimeException('should not matter'));

        $this->assertSame('canceled', $mediaJob->refresh()->status);
    }

    // -- helpers ----------------------------------------------------------

    private function realProcessor(FakeProcessRunner $runner, ?AudioPreprocessor $preprocessor = null): RealMediaProcessor
    {
        $root = sys_get_temp_dir().'/media-reliability-test-'.uniqid();
        mkdir($root, 0777, true);

        $transcriber = new WhisperTranscriber($runner, 'whisper-ctranslate2', 'large-v3', 'ar', 'vtt');

        return new RealMediaProcessor(
            $runner,
            $transcriber,
            'ffmpeg',
            'ffprobe',
            [],
            new OcrClient('http://ocr-test:8788'),
            $preprocessor,
            new MediaPathGuard($root),
        );
    }
}
