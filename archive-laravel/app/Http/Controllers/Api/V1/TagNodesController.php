<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class TagNodesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);

        $nodes = DB::table('tag_nodes')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatNode($row))
            ->values();

        return response()->json(['ok' => true, 'nodes' => $nodes]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tag' => ['required', 'string', 'max:200'],
            'parent' => ['required', 'string', 'max:200'],
        ]);

        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('tag_nodes')->insert([
            'id' => $id,
            'user_id' => $userId,
            'tag' => trim((string) $validated['tag']),
            'parent' => trim((string) $validated['parent']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'node' => $this->formatNode(DB::table('tag_nodes')->where('id', $id)->first()),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'tag' => ['sometimes', 'string', 'max:200'],
            'parent' => ['sometimes', 'string', 'max:200'],
        ]);

        $userId = $this->userId($request);
        $exists = DB::table('tag_nodes')->where('id', $id)->where('user_id', $userId)->exists();

        if (! $exists) {
            return response()->json(['ok' => false, 'error' => 'Tag node not found.', 'code' => 'not_found'], 404);
        }

        $changes = array_intersect_key($validated, array_flip(['tag', 'parent']));
        if ($changes !== []) {
            $changes['updated_at'] = now();
            DB::table('tag_nodes')->where('id', $id)->where('user_id', $userId)->update($changes);
        }

        return response()->json([
            'ok' => true,
            'node' => $this->formatNode(DB::table('tag_nodes')->where('id', $id)->first()),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);

        $deleted = DB::table('tag_nodes')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Tag node not found.', 'code' => 'not_found'], 404);
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
    private function formatNode(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'tag' => $row->tag,
            'parent' => $row->parent,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
