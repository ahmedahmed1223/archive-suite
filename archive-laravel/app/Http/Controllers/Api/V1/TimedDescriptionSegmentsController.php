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
        if ($denied = $this->requireEditor($request)) return $denied;
        $data = $request->validate(['startFrame' => ['required', 'integer', 'min:0'], 'endFrame' => ['required', 'integer', 'gt:startFrame'], 'title' => ['required', 'string', 'max:500'], 'description' => ['nullable', 'string', 'max:10000'], 'subjects' => ['sometimes', 'array'], 'subjects.*' => ['string', 'max:250'], 'place' => ['nullable', 'string', 'max:500'], 'rightsNote' => ['nullable', 'string', 'max:2000']]);
        $segment = TimedDescriptionSegment::query()->create(['id' => (string) Str::uuid(), 'record_id' => $recordId, 'start_frame' => $data['startFrame'], 'end_frame' => $data['endFrame'], 'title' => trim($data['title']), 'description' => $data['description'] ?? null, 'subjects' => $data['subjects'] ?? [], 'place' => $data['place'] ?? null, 'rights_note' => $data['rightsNote'] ?? null, 'created_by' => $request->attributes->get('archive_user')?->getKey()]);
        return response()->json(['ok' => true, 'segment' => $this->payload($segment)], 201);
    }

    /** @return array<string, mixed> */
    private function payload(TimedDescriptionSegment $segment): array
    {
        return ['id' => $segment->id, 'recordId' => $segment->record_id, 'startFrame' => $segment->start_frame, 'endFrame' => $segment->end_frame, 'title' => $segment->title, 'description' => $segment->description, 'subjects' => $segment->subjects ?? [], 'place' => $segment->place, 'rightsNote' => $segment->rights_note, 'createdAt' => $segment->created_at?->toISOString(), 'updatedAt' => $segment->updated_at?->toISOString()];
    }
}
