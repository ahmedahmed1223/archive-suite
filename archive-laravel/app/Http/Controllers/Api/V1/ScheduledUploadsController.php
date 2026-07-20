<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ScheduledUploadConflict;
use App\Exceptions\UploadContentMismatchException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateScheduledUploadRequest;
use App\Http\Requests\RescheduleUploadRequest;
use App\Http\Resources\ScheduledUploadResource;
use App\Models\ScheduledUpload;
use App\Services\Uploads\ScheduledUploadState;
use App\Services\Uploads\UploadStager;
use App\Support\ApiError;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * V1-712: create a scheduled upload from a completed chunked-upload session
 * (V1-711). The uploaded bytes are staged into a verified quarantine
 * artifact immediately — chunk assembly, checksum, and content-sniffing
 * reused from UploadStager — so the schedule row already references a safe,
 * disk-resident file by the time this returns. Only the deferred parts
 * (record creation, moving into the servable directory) wait for the
 * scheduled time, handled by a later task.
 */
class ScheduledUploadsController extends Controller
{
    public function __construct(
        private readonly UploadStager $stager,
        private readonly ScheduledUploadState $state,
    ) {}

    public function create(CreateScheduledUploadRequest $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $idempotencyKey = (string) $request->validated('idempotencyKey');
        $existing = ScheduledUpload::query()->where('idempotency_key', $idempotencyKey)->first();
        if ($existing !== null) {
            return response()->json(['ok' => true, 'schedule' => $this->present($existing)], 200);
        }

        $sessionId = (string) $request->validated('uploadSessionId');
        $session = DB::table('upload_sessions')->where('id', $sessionId)->first();
        if (! $session) {
            return response()->json(['ok' => false, 'error' => 'Upload session not found.', 'code' => 'session_not_found'], 404);
        }
        // Fast-path only: not authoritative. A concurrent request can change
        // the session's status between this check and the lock acquired
        // below, so the check is repeated under the lock — that one gates
        // staging.
        if ($conflict = $this->sessionConflict($session)) {
            return $conflict;
        }

        $staged = null;
        $conflict = null;

        try {
            $schedule = DB::transaction(function () use ($request, $sessionId, $idempotencyKey, &$staged, &$conflict): ?ScheduledUpload {
                $session = DB::table('upload_sessions')->where('id', $sessionId)->lockForUpdate()->firstOrFail();

                // Authoritative recheck: another request may have staged or
                // consumed this session while we waited on the lock.
                if ($conflict = $this->sessionConflict($session)) {
                    return null;
                }

                $staged = $this->stager->stage($session);

                $schedule = ScheduledUpload::query()->create([
                    'id' => (string) Str::uuid(),
                    'idempotency_key' => $idempotencyKey,
                    'created_by' => $request->attributes->get('archive_user')->id,
                    'disk' => $staged->disk,
                    'staged_path' => $staged->path,
                    'file_name' => $staged->fileName,
                    'total_size' => $staged->size,
                    'checksum_sha256' => $staged->checksum,
                    'record_payload' => $request->recordPayload(),
                    'scheduled_at' => $request->date('scheduledAt')->utc(),
                    'time_zone' => $request->validated('timeZone'),
                    'status' => 'scheduled',
                    'attempts' => 0,
                    'version' => 1,
                ]);

                DB::table('upload_sessions')->where('id', $session->id)->update(['status' => 'staged', 'updated_at' => now()]);

                return $schedule;
            });
        } catch (UploadContentMismatchException $exception) {
            // UploadStager already deleted the staged artifact and chunk
            // directory before throwing this — nothing left to clean up.
            return response()->json(['ok' => false, 'error' => $exception->getMessage(), 'code' => 'unsafe_file_content'], 422);
        } catch (Throwable $exception) {
            // Staging succeeded but the transaction failed afterward (e.g. a
            // concurrent insert). The DB rolled back on its own; the staged
            // artifact did not, so delete only that.
            if ($staged !== null) {
                Storage::disk($staged->disk)->delete($staged->path);
            }

            throw $exception;
        }

        if ($schedule === null) {
            return $conflict;
        }

        return response()->json(['ok' => true, 'schedule' => $this->present($schedule)], 201);
    }

    /**
     * V1-712 Task 3: cursor-paginated list, scoped to the caller's own rows
     * unless they're an admin (mirrors requireAdmin/requireEditor's role
     * split — editor is a "manage my own content" ability, not "see
     * everyone's queue").
     */
    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);
        $user = $request->attributes->get('archive_user');

        $query = ScheduledUpload::query()->orderBy('id')->limit($limit + 1);
        if ($user->role !== 'admin') {
            $query->where('created_by', $user->id);
        }
        if (isset($validated['cursor'])) {
            $query->where('id', '>', StorageRowPayload::decodeCursor($validated['cursor']));
        }

        $rows = $query->get();
        $hasMore = $rows->count() > $limit;
        $pageRows = $rows->take($limit);
        $lastRow = $pageRows->last();

        return response()->json([
            'ok' => true,
            'schedules' => $pageRows->map(fn (ScheduledUpload $row): array => (new ScheduledUploadResource($row))->resolve($request))->values(),
            'nextCursor' => $hasMore && $lastRow instanceof ScheduledUpload ? StorageRowPayload::encodeCursor($lastRow->id) : null,
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $schedule = ScheduledUpload::query()->find($id);
        if ($schedule === null) {
            return response()->json(ApiError::envelope('Scheduled upload not found.', 404), 404);
        }
        if ($denied = $this->authorizeOwnership($request, $schedule)) {
            return $denied;
        }

        return response()->json(['ok' => true, 'schedule' => (new ScheduledUploadResource($schedule))->resolve($request)]);
    }

    /**
     * Changes scheduled_at/time_zone only — the status stays 'scheduled'.
     * Reuses ScheduledUploadState::transition() as a self-loop
     * ('scheduled' -> 'scheduled') purely for its atomic version-checked
     * update; a row that isn't currently 'scheduled' has no legal self-loop
     * and falls straight into the same conflict handling.
     */
    public function reschedule(RescheduleUploadRequest $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $schedule = ScheduledUpload::query()->find($id);
        if ($schedule === null) {
            return response()->json(ApiError::envelope('Scheduled upload not found.', 404), 404);
        }
        if ($denied = $this->authorizeOwnership($request, $schedule)) {
            return $denied;
        }

        try {
            $updated = $this->state->transition($id, $schedule->status, $schedule->status, (int) $request->validated('version'), [
                'scheduled_at' => $request->date('scheduledAt')->utc(),
                'time_zone' => $request->validated('timeZone'),
            ]);
        } catch (ScheduledUploadConflict $exception) {
            return $this->conflictResponse($request, $exception, $id);
        }

        return response()->json(['ok' => true, 'schedule' => (new ScheduledUploadResource($updated))->resolve($request)]);
    }

    /**
     * Idempotent: cancelling an already-cancelled row is a no-op success.
     * Only a 'scheduled' row can be cancelled through this endpoint — once a
     * worker has claimed it (or moved further), the cancel window has
     * closed, even though the state machine itself still permits
     * claimed -> cancelled for worker-initiated cleanup (Task 4).
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $schedule = ScheduledUpload::query()->find($id);
        if ($schedule === null) {
            return response()->json(ApiError::envelope('Scheduled upload not found.', 404), 404);
        }
        if ($denied = $this->authorizeOwnership($request, $schedule)) {
            return $denied;
        }

        if ($schedule->status === 'cancelled') {
            return response()->json(['ok' => true, 'schedule' => (new ScheduledUploadResource($schedule))->resolve($request)]);
        }

        if ($schedule->status !== 'scheduled') {
            return response()->json([
                'ok' => false,
                'error' => 'This upload can no longer be cancelled.',
                'code' => 'illegal_transition',
                'current' => (new ScheduledUploadResource($schedule))->resolve($request),
            ], 409);
        }

        try {
            $updated = $this->state->transition($id, 'scheduled', 'cancelled', $schedule->version);
        } catch (ScheduledUploadConflict $exception) {
            return $this->conflictResponse($request, $exception, $id);
        }

        return response()->json(['ok' => true, 'schedule' => (new ScheduledUploadResource($updated))->resolve($request)]);
    }

    /**
     * Only requeues a 'failed' row whose failure_code marks it as an
     * infrastructure failure (see ScheduledUploadResource::canRetry) and
     * whose staged artifact is still on disk — a content/validation failure
     * or a swept artifact both mean retrying is pointless.
     */
    public function retry(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $schedule = ScheduledUpload::query()->find($id);
        if ($schedule === null) {
            return response()->json(ApiError::envelope('Scheduled upload not found.', 404), 404);
        }
        if ($denied = $this->authorizeOwnership($request, $schedule)) {
            return $denied;
        }

        if ($schedule->status !== 'failed' || ! str_starts_with((string) $schedule->failure_code, 'infrastructure_')) {
            return response()->json(['ok' => false, 'error' => 'This upload cannot be retried.', 'code' => 'not_retryable'], 409);
        }

        if (! Storage::disk($schedule->disk)->exists($schedule->staged_path)) {
            return response()->json(['ok' => false, 'error' => 'The staged file for this upload is no longer available.', 'code' => 'artifact_missing'], 409);
        }

        try {
            $updated = $this->state->transition($id, 'failed', 'scheduled', $schedule->version, [
                'failure_code' => null,
                'failure_message' => null,
            ]);
        } catch (ScheduledUploadConflict $exception) {
            return $this->conflictResponse($request, $exception, $id);
        }

        return response()->json(['ok' => true, 'schedule' => (new ScheduledUploadResource($updated))->resolve($request)]);
    }

    private function conflictResponse(Request $request, ScheduledUploadConflict $exception, string $id): JsonResponse
    {
        $current = ScheduledUpload::query()->find($id);

        return response()->json([
            'ok' => false,
            'error' => $exception->getMessage(),
            'code' => $exception->reason,
            'current' => $current !== null ? (new ScheduledUploadResource($current))->resolve($request) : null,
        ], 409);
    }

    /**
     * Admins may act on any row; an editor may only act on rows they
     * created. Returns 404 (not 403) for a non-owned row so an editor can't
     * use this endpoint to probe for the existence of other users' uploads.
     */
    private function authorizeOwnership(Request $request, ScheduledUpload $schedule): ?JsonResponse
    {
        $user = $request->attributes->get('archive_user');

        if ($user->role !== 'admin' && $schedule->created_by !== $user->id) {
            return response()->json(ApiError::envelope('Scheduled upload not found.', 404), 404);
        }

        return null;
    }

    /**
     * Returns the 409 conflict response if the session isn't stageable
     * (already consumed) or isn't complete yet, null if it's fine to stage.
     * Called both before the lock (fast path) and after (authoritative).
     */
    private function sessionConflict(object $session): ?JsonResponse
    {
        if ($session->status !== 'pending') {
            return response()->json(['ok' => false, 'error' => 'This upload session is no longer active.', 'code' => 'session_inactive'], 409);
        }

        $missing = UploadStager::missingChunks($session);
        if ($missing !== []) {
            return response()->json([
                'ok' => false,
                'error' => 'Not all chunks have been received.',
                'code' => 'incomplete_upload',
                'missingChunks' => $missing,
            ], 409);
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(ScheduledUpload $schedule): array
    {
        return [
            'id' => $schedule->id,
            'status' => $schedule->status,
            'fileName' => $schedule->file_name,
            'totalSize' => (int) $schedule->total_size,
            'scheduledAt' => $schedule->scheduled_at->toIso8601String(),
            'timeZone' => $schedule->time_zone,
            'record' => $schedule->record_payload,
        ];
    }
}
