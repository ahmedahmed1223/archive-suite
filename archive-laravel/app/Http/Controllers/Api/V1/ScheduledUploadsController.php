<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\UploadContentMismatchException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateScheduledUploadRequest;
use App\Models\ScheduledUpload;
use App\Services\Uploads\UploadStager;
use Illuminate\Http\JsonResponse;
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
    public function __construct(private readonly UploadStager $stager) {}

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
