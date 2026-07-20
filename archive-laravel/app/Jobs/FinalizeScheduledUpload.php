<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Exceptions\ScheduledUploadConflict;
use App\Models\ScheduledUpload;
use App\Models\User;
use App\Services\Uploads\ScheduledUploadState;
use App\Services\Uploads\UploadFinalizer;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * V1-712 Task 4: finalizes a claimed scheduled upload -- moves the staged
 * quarantine artifact into the servable directory and creates the archive
 * record, reusing the same UploadFinalizer the immediate-completion upload
 * paths use (single-shot /uploads and chunked-upload complete()).
 *
 * Genuinely idempotent against redelivery: a schedule that already has
 * record_id set means an earlier attempt's DB transaction (finalize()'s
 * storage_rows insert + this job's completed transition) already committed
 * -- handle() is then a silent no-op, so a duplicate delivery never creates
 * a second storage_rows record.
 */
class FinalizeScheduledUpload implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public readonly string $scheduleId)
    {
        $this->onQueue((string) config('scheduled-uploads.queue', 'scheduled-uploads'));
    }

    /**
     * Dedupe key: a second dispatch() for the same schedule id while one is
     * still queued is silently dropped instead of double-queueing.
     */
    public function uniqueId(): string
    {
        return $this->scheduleId;
    }

    /**
     * Prevents two workers from finalizing the same schedule id
     * concurrently.
     *
     * @return array<int, WithoutOverlapping>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping($this->scheduleId))->releaseAfter(30)];
    }

    /**
     * Jittered deterministically from the schedule id (not mt_rand()) so a
     * burst of claims made in the same dispatcher run doesn't retry in
     * lockstep, while a given schedule's own backoff stays stable and
     * reproducible across attempts/tests.
     *
     * @return array<int, int>
     */
    public function backoff(): array
    {
        $jitter = crc32($this->scheduleId) % 15;

        return array_map(static fn (int $seconds): int => $seconds + $jitter, [30, 120, 300, 600]);
    }

    public function handle(UploadFinalizer $finalizer, ScheduledUploadState $state): void
    {
        $schedule = ScheduledUpload::query()->find($this->scheduleId);

        if ($schedule === null) {
            Log::warning('FinalizeScheduledUpload: schedule no longer exists.', ['scheduleId' => $this->scheduleId]);

            return;
        }

        // Idempotent no-op: a prior attempt already committed the record
        // association -- redelivery must not create a second storage_rows
        // record or re-run the move.
        if ($schedule->record_id !== null || in_array($schedule->status, ['completed', 'cancelled'], true)) {
            return;
        }

        if ($schedule->status === 'claimed') {
            $schedule = $state->transition($schedule->id, 'claimed', 'processing', $schedule->version);
        } elseif ($schedule->status !== 'processing') {
            // Not claimable anymore (e.g. cancelled between claim and job
            // pickup, or already recovered by the watchdog) -- nothing to do.
            return;
        }

        if ($this->failTerminallyIfIneligible($schedule, $state)) {
            return;
        }

        $storedName = pathinfo($schedule->staged_path, PATHINFO_BASENAME);
        $targetDir = trim((string) config('ingest.directory'), '/').'/uploads';

        DB::transaction(function () use ($schedule, $finalizer, $state, $storedName, $targetDir): void {
            $result = $finalizer->finalize(
                $schedule->disk,
                $schedule->staged_path,
                $storedName,
                $schedule->file_name,
                (string) $schedule->checksum_sha256,
                $targetDir,
            );

            $state->transition($schedule->id, 'processing', 'completed', $schedule->version, [
                'record_id' => $result['recordId'],
            ]);
        });
    }

    /**
     * Rechecks the things that can go stale between scheduling and the job
     * actually running: the creator's role/existence, the staged artifact's
     * presence, and its checksum. All three are terminal, non-retryable
     * failures -- they transition straight to 'failed' and return true
     * without throwing, so Laravel's queue retry mechanism never fires for
     * them (only a thrown exception triggers a retry attempt).
     */
    private function failTerminallyIfIneligible(ScheduledUpload $schedule, ScheduledUploadState $state): bool
    {
        $creator = $schedule->created_by !== null ? User::query()->find($schedule->created_by) : null;

        if ($creator === null || Gate::forUser($creator)->denies('manage-content')) {
            $this->failTerminally($schedule, $state, 'creator_ineligible', 'The user who scheduled this upload no longer has permission to create records.');

            return true;
        }

        $storage = Storage::disk($schedule->disk);

        if (! $storage->exists($schedule->staged_path)) {
            $this->failTerminally($schedule, $state, 'artifact_missing', 'The staged file for this upload is no longer available.');

            return true;
        }

        if ($schedule->checksum_sha256 !== null && strtolower((string) $schedule->checksum_sha256) !== $this->hashStagedFile($storage, $schedule->staged_path)) {
            $this->failTerminally($schedule, $state, 'checksum_mismatch', 'The staged file no longer matches the checksum recorded at scheduling time.');

            return true;
        }

        return false;
    }

    /**
     * Streamed sha256 (matches UploadStager::assembleChunks' incremental
     * hashing) so rechecking a large media file's checksum doesn't load the
     * whole thing into memory just to recompute a digest.
     */
    private function hashStagedFile(Filesystem $storage, string $path): string
    {
        $stream = $storage->readStream($path);

        if (! is_resource($stream)) {
            return '';
        }

        $context = hash_init('sha256');

        try {
            while (! feof($stream)) {
                $chunk = fread($stream, 1024 * 1024);
                if ($chunk !== false) {
                    hash_update($context, $chunk);
                }
            }
        } finally {
            fclose($stream);
        }

        return hash_final($context);
    }

    private function failTerminally(ScheduledUpload $schedule, ScheduledUploadState $state, string $code, string $message): void
    {
        try {
            $state->transition($schedule->id, 'processing', 'failed', $schedule->version, [
                'failure_code' => $code,
                'failure_message' => $message,
            ]);
        } catch (ScheduledUploadConflict) {
            // Already moved on concurrently (e.g. cancelled) -- nothing to do.
        }
    }

    /**
     * Called once, after retries are exhausted, for a genuinely retryable
     * failure (finalize() threw -- storage error, DB error, etc). Terminal
     * failures (checksum/missing artifact/ineligible creator) never reach
     * this: they return from handle() without throwing.
     */
    public function failed(Throwable $exception): void
    {
        $schedule = ScheduledUpload::query()->find($this->scheduleId);

        if ($schedule === null || in_array($schedule->status, ['completed', 'cancelled', 'failed'], true)) {
            return;
        }

        try {
            app(ScheduledUploadState::class)->transition($schedule->id, $schedule->status, 'failed', $schedule->version, [
                'failure_code' => 'infrastructure_finalize_failed',
                'failure_message' => $this->sanitizeError($exception),
            ]);
        } catch (ScheduledUploadConflict) {
            // Already moved on concurrently (e.g. recovered by the watchdog, or
            // the transition is illegal from wherever it ended up) -- nothing to do.
        }
    }

    /**
     * Strip anything that looks like an absolute filesystem path (Unix or
     * Windows) out of exception messages before they reach the stored
     * failure_message (mirrors ProcessMediaWorkflow::sanitizeError).
     */
    private function sanitizeError(Throwable $error): string
    {
        $message = preg_replace('#(?:[A-Za-z]:[\\\\/]|/)[^\s\'"]*#', '[path]', $error->getMessage())
            ?? 'Scheduled upload finalize failed.';

        return mb_substr(trim($message), 0, 500);
    }
}
