<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

// V1-840: named time/topic segments linked to a record, no file copy.
class RecordSegmentsController extends Controller
{
    public function index(string $recordId): JsonResponse
    {
        $segments = DB::table('record_segments')
            ->where('record_id', $recordId)
            ->orderBy('created_at')
            ->get()
            ->map(fn (stdClass $segment): array => $this->formatSegment($segment))
            ->values();

        return response()->json(['ok' => true, 'segments' => $segments]);
    }

    public function store(Request $request, string $recordId): JsonResponse
    {
        $validated = $request->validate($this->rules(requireTitle: true));

        $id = (string) Str::uuid();
        $now = now();
        DB::table('record_segments')->insert([
            'id' => $id,
            'record_id' => $recordId,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? '',
            'tags' => json_encode($validated['tags'] ?? [], JSON_THROW_ON_ERROR),
            'start_seconds' => $validated['startSeconds'] ?? null,
            'end_seconds' => $validated['endSeconds'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $segment = DB::table('record_segments')->where('id', $id)->first();

        return response()->json(['ok' => true, 'segment' => $this->formatSegment($segment)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $segment = DB::table('record_segments')->where('id', $id)->first();
        if (! $segment instanceof stdClass) {
            return $this->notFound();
        }

        $validated = $request->validate($this->rules(requireTitle: false));
        $updates = ['updated_at' => now()];

        if (array_key_exists('title', $validated)) $updates['title'] = $validated['title'];
        if (array_key_exists('description', $validated)) $updates['description'] = $validated['description'];
        if (array_key_exists('tags', $validated)) $updates['tags'] = json_encode($validated['tags'], JSON_THROW_ON_ERROR);
        if (array_key_exists('startSeconds', $validated)) $updates['start_seconds'] = $validated['startSeconds'];
        if (array_key_exists('endSeconds', $validated)) $updates['end_seconds'] = $validated['endSeconds'];

        DB::table('record_segments')->where('id', $id)->update($updates);
        $updated = DB::table('record_segments')->where('id', $id)->first();

        return response()->json(['ok' => true, 'segment' => $this->formatSegment($updated)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $deleted = DB::table('record_segments')->where('id', $id)->delete();

        if ($deleted < 1) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Segment not found.', 'code' => 'not_found'], 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $requireTitle): array
    {
        return [
            'title' => [$requireTitle ? 'required' : 'sometimes', 'string', 'min:1', 'max:200'],
            'description' => ['sometimes', 'string'],
            'tags' => ['sometimes', 'array'],
            'tags.*' => ['string'],
            'startSeconds' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'endSeconds' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatSegment(stdClass $segment): array
    {
        return [
            'id' => $segment->id,
            'recordId' => $segment->record_id,
            'title' => $segment->title,
            'description' => $segment->description ?? '',
            'tags' => $segment->tags ? json_decode((string) $segment->tags, true) : [],
            'startSeconds' => $segment->start_seconds !== null ? (float) $segment->start_seconds : null,
            'endSeconds' => $segment->end_seconds !== null ? (float) $segment->end_seconds : null,
            'createdAt' => $segment->created_at,
            'updatedAt' => $segment->updated_at,
        ];
    }
}
