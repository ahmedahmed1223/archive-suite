<?php

namespace App\Jobs;

use App\Exceptions\JobCanceledException;
use App\Models\MediaJob;
use App\Services\Media\MediaProcessor;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * V1-113: real timeouts/backoff/idempotency/cancel for the one background
 * job this app dispatches. $timeout/$tries/backoff() are Laravel's native
 * knobs (config-driven, see config/media.php); ShouldBeUnique + the
 * WithoutOverlapping middleware are Laravel's built-in idempotency
 * primitives — no bespoke job framework.
 */
class ProcessMediaWorkflow implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    /** Hard ceiling on a single attempt's run time (seconds). */
    public int $timeout;

    /** Max attempts before Laravel calls failed() and stops retrying. */
    public int $tries;

    /** How long the uniqueId() lock is held (seconds). */
    public int $uniqueFor;

    public function __construct(public readonly string $mediaJobId)
    {
        $this->timeout = (int) config('media.job_timeout_seconds', 900);
        $this->tries = (int) config('media.job_tries', 3);
        $this->uniqueFor = (int) config('media.job_unique_for_seconds', 3600);
    }

    /**
     * Dedupe key for ShouldBeUnique: a second dispatch() for the same media
     * job id, while one is still queued or the lock hasn't expired, is
     * silently dropped instead of creating a duplicate queued run.
     */
    public function uniqueId(): string
    {
        return $this->mediaJobId;
    }

    /**
     * Prevents two workers from processing the same media job id
     * concurrently (e.g. the database queue driver's retry_after making the
     * job visible again to another worker while the first is still running
     * past that window). Overlapping attempts are released back to the
     * queue rather than run twice.
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping($this->mediaJobId))->releaseAfter(30)];
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return (array) config('media.job_backoff_seconds', [30, 120, 300]);
    }

    public function handle(MediaProcessor $processor): void
    {
        $mediaJob = MediaJob::query()->find($this->mediaJobId);

        if (! $mediaJob || $mediaJob->status === 'canceled') {
            // Canceled while still queued (the common case — cancel() only
            // flips a DB flag, it can't reach into an already-running
            // attempt for anything but the multi-segment transcription
            // checkpoint the processor itself guards).
            return;
        }

        $mediaJob->forceFill([
            'status' => 'processing',
            'started_at' => now(),
            'error' => null,
        ])->save();

        try {
            $artifacts = $processor->process($mediaJob);

            $mediaJob->forceFill([
                'status' => 'completed',
                'result' => [
                    'operation' => $mediaJob->operation,
                    'recordId' => $mediaJob->record_id,
                    'artifacts' => $artifacts,
                ],
                'completed_at' => now(),
            ])->save();
        } catch (JobCanceledException) {
            // Intentional stop, not a failure: leave status as 'canceled'
            // (already set by the cancel endpoint), don't retry.
            $mediaJob->forceFill(['completed_at' => now()])->save();
        } catch (Throwable $error) {
            Log::error('Media job attempt failed', [
                'mediaJobId' => $this->mediaJobId,
                'operation' => $mediaJob->operation,
                'attempt' => $this->attempts(),
                'exception' => $error,
            ]);

            $mediaJob->forceFill(['error' => $this->sanitizeError($error)])->save();

            throw $error;
        }
    }

    /**
     * Called once by Laravel after retries are exhausted (or immediately for
     * a non-retryable failure). This is where 'failed' actually gets
     * written — not on every attempt — so a job that succeeds on retry
     * never shows a stale failed status.
     */
    public function failed(Throwable $exception): void
    {
        $mediaJob = MediaJob::query()->find($this->mediaJobId);

        if (! $mediaJob || in_array($mediaJob->status, ['canceled', 'completed'], true)) {
            return;
        }

        $mediaJob->forceFill([
            'status' => 'failed',
            'error' => $this->sanitizeError($exception),
            'completed_at' => now(),
        ])->save();
    }

    /**
     * Strip anything that looks like an absolute filesystem path (Unix or
     * Windows) out of exception messages before they reach the job-facing
     * API. ffmpeg/whisper stderr and path-guard exceptions can otherwise
     * echo real on-disk paths back to the client.
     */
    private function sanitizeError(Throwable $error): string
    {
        $message = preg_replace('#(?:[A-Za-z]:[\\\\/]|/)[^\s\'"]*#', '[path]', $error->getMessage())
            ?? 'Media processing failed.';

        return mb_substr(trim($message), 0, 500);
    }
}
