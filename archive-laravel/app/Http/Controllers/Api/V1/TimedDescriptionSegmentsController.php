<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TimedDescriptionSegment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TimedDescriptionSegmentsController extends Controller
{
    public function index(string $recordId): JsonResponse
    {
        return response()->json(['ok' => true, 'segments' => TimedDescriptionSegment::query()->where('record_id', $recordId)->orderBy('start_frame')->get()->map(fn (TimedDescriptionSegment $segment) => $this->payload($segment))->values()]);
    }

    public function store(Request $request, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $data = $request->validate(['startFrame' => ['required', 'integer', 'min:0'], 'endFrame' => ['required', 'integer', 'gt:startFrame'], 'title' => ['required', 'string', 'max:500'], 'description' => ['nullable', 'string', 'max:10000'], 'subjects' => ['sometimes', 'array'], 'subjects.*' => ['string', 'max:250'], 'place' => ['nullable', 'string', 'max:500'], 'rightsNote' => ['nullable', 'string', 'max:2000']]);
        $segment = TimedDescriptionSegment::query()->create(['id' => (string) Str::uuid(), 'record_id' => $recordId, 'start_frame' => $data['startFrame'], 'end_frame' => $data['endFrame'], 'title' => trim($data['title']), 'description' => $data['description'] ?? null, 'subjects' => $data['subjects'] ?? [], 'place' => $data['place'] ?? null, 'rights_note' => $data['rightsNote'] ?? null, 'created_by' => $request->attributes->get('archive_user')?->getKey()]);

        return response()->json(['ok' => true, 'segment' => $this->payload($segment)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $segment = TimedDescriptionSegment::query()->find($id);
        if (! $segment) {
            return response()->json(['ok' => false, 'error' => 'Timed description segment not found.', 'code' => 'not_found'], 404);
        }

        $data = $request->validate([
            'startFrame' => ['sometimes', 'integer', 'min:0'],
            'endFrame' => ['sometimes', 'integer', 'min:1'],
            'title' => ['sometimes', 'string', 'min:1', 'max:500'],
            'description' => ['nullable', 'string', 'max:10000'],
            'subjects' => ['sometimes', 'array'],
            'subjects.*' => ['string', 'max:250'],
            'place' => ['nullable', 'string', 'max:500'],
            'rightsNote' => ['nullable', 'string', 'max:2000'],
        ]);
        $startFrame = $data['startFrame'] ?? $segment->start_frame;
        $endFrame = $data['endFrame'] ?? $segment->end_frame;
        if ($endFrame <= $startFrame) {
            return response()->json(['ok' => false, 'error' => 'The end frame must be greater than the start frame.', 'code' => 'validation_failed'], 422);
        }

        $segment->fill([
            'start_frame' => $startFrame,
            'end_frame' => $endFrame,
            'title' => array_key_exists('title', $data) ? trim($data['title']) : $segment->title,
            'description' => $data['description'] ?? $segment->description,
            'subjects' => $data['subjects'] ?? $segment->subjects,
            'place' => $data['place'] ?? $segment->place,
            'rights_note' => $data['rightsNote'] ?? $segment->rights_note,
        ])->save();

        return response()->json(['ok' => true, 'segment' => $this->payload($segment->fresh())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $segment = TimedDescriptionSegment::query()->find($id);
        if (! $segment) {
            return response()->json(['ok' => false, 'error' => 'Timed description segment not found.', 'code' => 'not_found'], 404);
        }
        $segment->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /** @return array<string, mixed> */
    private function payload(TimedDescriptionSegment $segment): array
    {
        return ['id' => $segment->id, 'recordId' => $segment->record_id, 'startFrame' => $segment->start_frame, 'endFrame' => $segment->end_frame, 'title' => $segment->title, 'description' => $segment->description, 'subjects' => $segment->subjects ?? [], 'place' => $segment->place, 'rightsNote' => $segment->rights_note, 'createdAt' => $segment->created_at?->toISOString(), 'updatedAt' => $segment->updated_at?->toISOString()];
    }
}
