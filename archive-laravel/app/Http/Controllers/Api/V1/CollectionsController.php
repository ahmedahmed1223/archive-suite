<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class CollectionsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);

        $collections = DB::table('collections')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatCollection($row))
            ->values();

        return response()->json(['ok' => true, 'collections' => $collections]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'query' => ['nullable', 'string', 'max:500'],
            'type' => ['nullable', 'string', 'max:200'],
            'tag' => ['nullable', 'string', 'max:200'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('collections')->insert([
            'id' => $id,
            'user_id' => $userId,
            'name' => trim((string) $validated['name']),
            'query' => $validated['query'] ?? null,
            'type' => $validated['type'] ?? 'all',
            'tag' => $validated['tag'] ?? 'all',
            'icon' => $validated['icon'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $collection = DB::table('collections')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'collection' => $this->formatCollection($collection),
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $userId = $this->userId($request);

        $deleted = DB::table('collections')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted < 1) {
            return response()->json([
                'ok' => false,
                'error' => 'Collection not found.',
                'code' => 'not_found',
            ], 404);
        }

        DB::table('collection_records')->where('collection_id', $id)->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    // V1-873: rename/re-criteria an existing saved collection instead of only
    // ever being able to create a new one.
    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;

        $collection = $this->owned($request, $id);
        if (! $collection) return $this->notFound();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:200'],
            'query' => ['sometimes', 'nullable', 'string', 'max:500'],
            'type' => ['sometimes', 'nullable', 'string', 'max:200'],
            'tag' => ['sometimes', 'nullable', 'string', 'max:200'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        if ($validated === []) {
            return response()->json(['ok' => false, 'error' => 'At least one field is required.', 'code' => 'validation_failed'], 422);
        }

        $updates = ['updated_at' => now()];
        foreach (['name', 'query', 'type', 'tag', 'icon'] as $field) {
            if (array_key_exists($field, $validated)) $updates[$field] = $validated[$field];
        }

        DB::table('collections')->where('id', $id)->update($updates);
        $updated = DB::table('collections')->where('id', $id)->first();

        return response()->json(['ok' => true, 'collection' => $this->formatCollection($updated)]);
    }

    public function records(Request $request, string $id): JsonResponse
    {
        if (! $this->owned($request, $id)) return $this->notFound();

        $recordIds = DB::table('collection_records')
            ->where('collection_id', $id)
            ->orderBy('added_at')
            ->pluck('record_id');

        return response()->json(['ok' => true, 'recordIds' => $recordIds]);
    }

    public function addRecord(Request $request, string $id, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        if (! $this->owned($request, $id)) return $this->notFound();

        DB::table('collection_records')->updateOrInsert(
            ['collection_id' => $id, 'record_id' => $recordId],
            ['added_at' => now()]
        );

        return response()->json(['ok' => true]);
    }

    public function removeRecord(Request $request, string $id, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        if (! $this->owned($request, $id)) return $this->notFound();

        DB::table('collection_records')->where('collection_id', $id)->where('record_id', $recordId)->delete();

        return response()->json(['ok' => true]);
    }

    private function owned(Request $request, string $id): ?stdClass
    {
        $row = DB::table('collections')->where('id', $id)->where('user_id', $this->userId($request))->first();

        return $row instanceof stdClass ? $row : null;
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Collection not found.', 'code' => 'not_found'], 404);
    }

    private function userId(Request $request): string
    {
        $user = $request->attributes->get('archive_user');

        return (string) $user?->getKey();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatCollection(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'name' => $row->name,
            'query' => $row->query,
            'type' => $row->type,
            'tag' => $row->tag,
            'icon' => $row->icon,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
