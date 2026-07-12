<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Models\User;
use App\Services\Media\MediaPathGuard;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MediaJobsController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $safePathRule = function (string $attribute, mixed $value, Closure $fail): void {
            if (! MediaPathGuard::isSafeRelative((string) $value)) {
                $fail("The {$attribute} must be a relative path without \"..\" traversal or an absolute path.");
            }
        };

        $validated = $request->validate([
            'recordId' => ['required', 'string', 'max:255', $safePathRule],
            'operation' => ['required', 'string', Rule::in(['thumbnail', 'transcode', 'transcription', 'ocr', 'montage_export'])],
            'sourcePath' => ['nullable', 'string', 'max:2048', $safePathRule],
            'options' => ['nullable', 'array'],
            'options.clips' => ['nullable', 'array'],
            'options.clips.*.path' => ['nullable', 'string', 'max:2048', $safePathRule],
            'options.watermark' => ['nullable', 'array'],
            'options.watermark.path' => ['nullable', 'string', 'max:2048', $safePathRule],
        ]);

        $mediaJob = MediaJob::query()->create([
            'id' => (string) Str::uuid(),
            'record_id' => $validated['recordId'],
            'created_by' => $this->userId($request),
            'operation' => $validated['operation'],
            'status' => 'queued',
            'source_path' => $validated['sourcePath'] ?? null,
            'options' => $validated['options'] ?? [],
            'queued_at' => now(),
        ]);

        ProcessMediaWorkflow::dispatch($mediaJob->id);

        return response()->json([
            'ok' => true,
            'job' => $this->payload($mediaJob->refresh()),
        ], 202);
    }

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $recordId = $request->query('recordId');
        $limit = (int) ($request->query('limit', 20));
        $limit = min(max($limit, 1), 100); // Cap between 1-100

        $query = MediaJob::query();

        if (! $this->isAdmin($request)) {
            $query->where('created_by', $this->userId($request));
        }

        if ($status) {
            $query->where('status', $status);
        }

        if ($recordId) {
            $query->where('record_id', $recordId);
        }

        $jobs = $query
            ->orderByDesc('queued_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'ok' => true,
            'jobs' => $jobs->map(fn (MediaJob $job) => $this->payload($job))->values()->toArray(),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $mediaJob = MediaJob::query()->find($id);

        if (! $mediaJob || ! $this->canAccess($request, $mediaJob)) {
            return response()->json(['ok' => false, 'error' => 'Media job not found.'], 404);
        }

        return response()->json([
            'ok' => true,
            'job' => $this->payload($mediaJob),
        ]);
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $mediaJob = MediaJob::query()->find($id);

        if (! $mediaJob || ! $this->canAccess($request, $mediaJob)) {
            return response()->json(['ok' => false, 'error' => 'Media job not found.'], 404);
        }

        if ($mediaJob->status === 'completed' || $mediaJob->status === 'failed' || $mediaJob->status === 'canceled') {
            return response()->json(['ok' => false, 'error' => "Cannot cancel job with status: {$mediaJob->status}"], 400);
        }

        $mediaJob->update([
            'status' => 'canceled',
            'completed_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'job' => $this->payload($mediaJob),
        ]);
    }

    /**
     * Non-admins may only reach jobs they created; admins reach every job.
     */
    private function canAccess(Request $request, MediaJob $mediaJob): bool
    {
        if ($this->isAdmin($request)) {
            return true;
        }

        $userId = $this->userId($request);

        return $userId !== null && $userId === (string) $mediaJob->created_by;
    }

    private function isAdmin(Request $request): bool
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User && $user->role === 'admin';
    }

    private function userId(Request $request): ?string
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? (string) $user->getKey() : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(MediaJob $mediaJob): array
    {
        return [
            'id' => $mediaJob->id,
            'recordId' => $mediaJob->record_id,
            'operation' => $mediaJob->operation,
            'status' => $mediaJob->status,
            'sourcePath' => $mediaJob->source_path,
            'options' => $mediaJob->options ?? [],
            'result' => $mediaJob->result,
            'error' => $mediaJob->error,
            'progressStage' => $mediaJob->progress_stage,
            'progressPercent' => $mediaJob->progress_percent,
            'queuedAt' => $mediaJob->queued_at?->toISOString(),
            'startedAt' => $mediaJob->started_at?->toISOString(),
            'completedAt' => $mediaJob->completed_at?->toISOString(),
        ];
    }
}
