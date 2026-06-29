<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MediaJobsController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recordId' => ['required', 'string'],
            'operation' => ['required', 'string', Rule::in(['thumbnail', 'transcode', 'transcription'])],
            'sourcePath' => ['nullable', 'string'],
            'options' => ['nullable', 'array'],
        ]);

        $mediaJob = MediaJob::query()->create([
            'id' => (string) Str::uuid(),
            'record_id' => $validated['recordId'],
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

    public function show(string $id): JsonResponse
    {
        $mediaJob = MediaJob::query()->find($id);

        if (! $mediaJob) {
            return response()->json(['ok' => false, 'error' => 'Media job not found.'], 404);
        }

        return response()->json([
            'ok' => true,
            'job' => $this->payload($mediaJob),
        ]);
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
            'queuedAt' => $mediaJob->queued_at?->toISOString(),
            'startedAt' => $mediaJob->started_at?->toISOString(),
            'completedAt' => $mediaJob->completed_at?->toISOString(),
        ];
    }
}
