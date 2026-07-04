<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class SavedSearchesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);

        $searches = DB::table('saved_searches')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatSearch($row))
            ->values();

        return response()->json(['ok' => true, 'searches' => $searches]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'query' => ['nullable', 'string', 'max:500'],
            'filters' => ['nullable', 'array'],
        ]);

        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('saved_searches')->insert([
            'id' => $id,
            'user_id' => $userId,
            'name' => trim((string) $validated['name']),
            'query' => $validated['query'] ?? null,
            'filters' => isset($validated['filters']) ? json_encode($validated['filters'], JSON_THROW_ON_ERROR) : null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $search = DB::table('saved_searches')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'search' => $this->formatSearch($search),
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);

        $deleted = DB::table('saved_searches')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted < 1) {
            return response()->json([
                'ok' => false,
                'error' => 'Saved search not found.',
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
    private function formatSearch(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'name' => $row->name,
            'query' => $row->query,
            'filters' => $row->filters ? json_decode((string) $row->filters, true) : null,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
