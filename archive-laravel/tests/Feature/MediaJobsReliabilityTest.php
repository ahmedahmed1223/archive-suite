<?php

namespace Tests\Feature;

use App\Exceptions\JobCanceledException;
use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Services\Media\AudioPreprocessor;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\MediaJobExecutor;
use App\Services\Media\MediaPathGuard;
use App\Services\Media\MediaProcessor;
use App\Services\Media\OcrClient;
use App\Services\Media\ProcessRunner;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\WhisperTranscriber;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;
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
            ->handle($this->app->make(MediaJobExecutor::class));

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

        $runner = new FakeProcessRunner;
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

        $runner = new FakeProcessRunner;
        $preprocessor = new class($mediaJob, $runner) extends AudioPreprocessor
        {
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

    /**
     * V3-PERF-005: cancellation must actually stop a running ffmpeg
     * subprocess, not just take effect at the next checkpoint. Distinct from
     * test_processor_refuses_to_run_a_canceled_job above -- that one is
     * canceled before process() ever starts (the entry guard catches it).
     * Here the job is still 'processing' when process() starts (the entry
     * guard passes) and only flips to canceled once the ffmpeg subprocess is
     * "running" -- SymfonyProcessRunner's poll loop (via the fake runner) is
     * what has to notice it.
     */
    public function test_thumbnail_processing_stops_when_canceled_during_the_ffmpeg_subprocess(): void
    {
        $mediaJob = MediaJob::query()->create([
            'id' => 'canceled-during-thumbnail-subprocess',
            'record_id' => 'record-thumb-cancel',
            'operation' => 'thumbnail',
            'status' => 'processing',
            'source_path' => 'archive/source.mov',
            'options' => [],
            'queued_at' => now(),
        ]);

        // Simulates cancel() landing exactly while ffmpeg is running: flips
        // the DB row right before the runner checks isCanceled(), so it's
        // the runner-level check -- not the entry guard -- that catches it.
        $runner = new class extends FakeProcessRunner
        {
            public function run(array $command, ?callable $onProgress = null, ?callable $isCanceled = null): array
            {
                MediaJob::query()->where('id', 'canceled-during-thumbnail-subprocess')->update(['status' => 'canceled']);

                return parent::run($command, $onProgress, $isCanceled);
            }
        };

        $processor = $this->realProcessor($runner);

        $this->expectException(JobCanceledException::class);

        try {
            $processor->process($mediaJob);
        } finally {
            $this->assertSame('canceled', $mediaJob->refresh()->status);
        }
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

        $this->mock(MediaProcessor::class, function ($mock): void {
            $mock->shouldNotReceive('process');
        });

        $job = $this->app->make(ProcessMediaWorkflow::class, ['mediaJobId' => $mediaJob->id]);
        $job->handle($this->app->make(MediaJobExecutor::class));

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
            $job->handle($this->app->make(MediaJobExecutor::class));
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

    // -- V3-PERF-002: request-id + queue-wait tracing ---------------------

    public function test_dispatched_at_defaults_to_construction_time_when_not_supplied(): void
    {
        $before = CarbonImmutable::now();
        $job = new ProcessMediaWorkflow('trace-default-dispatched-at');
        $after = CarbonImmutable::now();

        $dispatchedAt = CarbonImmutable::parse($job->dispatchedAt);
        $this->assertTrue($dispatchedAt->betweenIncluded($before, $after));
    }

    public function test_a_queue_wait_at_or_over_the_threshold_logs_a_sanitized_slow_queue_job_event(): void
    {
        config(['observability.slow_queue_wait_threshold_ms' => 0]);
        Log::spy();

        $job = $this->app->make(ProcessMediaWorkflow::class, [
            'mediaJobId' => 'no-such-media-job',
            'requestId' => 'trace-queue-wait-1',
            'dispatchedAt' => CarbonImmutable::now()->subSeconds(30)->toIso8601String(),
        ]);
        $job->handle($this->app->make(MediaJobExecutor::class));

        $captured = null;
        Log::shouldHaveReceived('warning')->once()->withArgs(function (string $message, array $context) use (&$captured): bool {
            $captured = [$message, $context];

            return true;
        });

        [$message, $context] = $captured;
        $this->assertSame('slow_queue_job', $message);
        $this->assertSame(['request_id', 'job', 'queue_wait_ms', 'timestamp'], array_keys($context));
        $this->assertSame('trace-queue-wait-1', $context['request_id']);
        $this->assertSame('ProcessMediaWorkflow', $context['job']);
        $this->assertGreaterThanOrEqual(30_000, $context['queue_wait_ms']);

        // Sanitized: no media job id, source path, or other payload details.
        $serialized = json_encode($context, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('no-such-media-job', $serialized);
    }

    public function test_a_queue_wait_under_the_threshold_is_not_logged_as_slow(): void
    {
        config(['observability.slow_queue_wait_threshold_ms' => 60_000]);
        Log::spy();

        $job = $this->app->make(ProcessMediaWorkflow::class, [
            'mediaJobId' => 'no-such-media-job-2',
            'requestId' => 'trace-queue-wait-2',
        ]);
        $job->handle($this->app->make(MediaJobExecutor::class));

        Log::shouldNotHaveReceived('warning', ['slow_queue_job', \Mockery::type('array')]);
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
