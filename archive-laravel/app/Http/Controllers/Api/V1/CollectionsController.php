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

        return response()->json(['ok' => true, 'deleted' => true]);
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
