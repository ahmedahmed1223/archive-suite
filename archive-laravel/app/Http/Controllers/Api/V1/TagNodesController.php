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
            'color' => ['sometimes', 'string', 'max:7', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'order_index' => ['sometimes', 'integer', 'min:0'],
        ]);

        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('tag_nodes')->insert([
            'id' => $id,
            'user_id' => $userId,
            'tag' => trim((string) $validated['tag']),
            'parent' => trim((string) $validated['parent']),
            'color' => $validated['color'] ?? null,
            'order_index' => $validated['order_index'] ?? 0,
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
            'color' => ['sometimes', 'nullable', 'string', 'max:7', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'order_index' => ['sometimes', 'integer', 'min:0'],
        ]);

        $userId = $this->userId($request);
        $exists = DB::table('tag_nodes')->where('id', $id)->where('user_id', $userId)->exists();

        if (! $exists) {
            return response()->json(['ok' => false, 'error' => 'Tag node not found.', 'code' => 'not_found'], 404);
        }

        $changes = array_intersect_key($validated, array_flip(['tag', 'parent', 'color', 'order_index']));
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

    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order' => ['required', 'array'],
            'order.*.id' => ['required', 'string'],
            'order.*.order_index' => ['required', 'integer', 'min:0'],
        ]);

        $userId = $this->userId($request);

        foreach ($validated['order'] as $item) {
            DB::table('tag_nodes')
                ->where('id', $item['id'])
                ->where('user_id', $userId)
                ->update(['order_index' => $item['order_index'], 'updated_at' => now()]);
        }

        return response()->json(['ok' => true, 'updated' => count($validated['order'])]);
    }

    public function merge(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'mergeInto' => ['required', 'string'],
        ]);

        $userId = $this->userId($request);

        // Verify both tags exist
        $source = DB::table('tag_nodes')->where('id', $id)->where('user_id', $userId)->first();
        $target = DB::table('tag_nodes')
            ->where('id', $validated['mergeInto'])
            ->where('user_id', $userId)
            ->first();

        if (! $source || ! $target) {
            return response()->json(['ok' => false, 'error' => 'One or both tags not found.', 'code' => 'not_found'], 404);
        }

        if ($source->tag === $target->tag) {
            return response()->json(['ok' => false, 'error' => 'Cannot merge a tag into itself.', 'code' => 'invalid_operation'], 400);
        }

        // Move children of source to target
        DB::table('tag_nodes')
            ->where('parent', $source->tag)
            ->where('user_id', $userId)
            ->update(['parent' => $target->tag, 'updated_at' => now()]);

        // Delete source node
        DB::table('tag_nodes')->where('id', $id)->where('user_id', $userId)->delete();

        return response()->json([
            'ok' => true,
            'merged' => true,
            'targetNode' => $this->formatNode($target),
        ]);
    }

    public function move(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'parent' => ['required', 'string'],
            'deleteChildren' => ['sometimes', 'boolean'],
        ]);

        $userId = $this->userId($request);
        $node = DB::table('tag_nodes')->where('id', $id)->where('user_id', $userId)->first();

        if (! $node) {
            return response()->json(['ok' => false, 'error' => 'Tag node not found.', 'code' => 'not_found'], 404);
        }

        // Prevent circular hierarchy
        $newParent = DB::table('tag_nodes')
            ->where('tag', $validated['parent'])
            ->where('user_id', $userId)
            ->first();

        if ($newParent && $this->isDescendant($newParent->tag, $node->tag, $userId)) {
            return response()->json(
                ['ok' => false, 'error' => 'Cannot move tag to its own descendant.', 'code' => 'circular_hierarchy'],
                400
            );
        }

        if ((bool) ($validated['deleteChildren'] ?? false)) {
            DB::table('tag_nodes')
                ->where('parent', $node->tag)
                ->where('user_id', $userId)
                ->delete();
        } else {
            DB::table('tag_nodes')
                ->where('parent', $node->tag)
                ->where('user_id', $userId)
                ->update(['parent' => $validated['parent'], 'updated_at' => now()]);
        }

        DB::table('tag_nodes')->where('id', $id)->where('user_id', $userId)->update([
            'parent' => $validated['parent'],
            'updated_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'moved' => true,
            'node' => $this->formatNode(DB::table('tag_nodes')->where('id', $id)->first()),
        ]);
    }

    private function isDescendant(string $parent, string $tag, string $userId): bool
    {
        $child = DB::table('tag_nodes')
            ->where('tag', $parent)
            ->where('user_id', $userId)
            ->first();

        if (! $child) {
            return false;
        }

        if ($child->parent === $tag) {
            return true;
        }

        return $this->isDescendant($child->parent, $tag, $userId);
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
            'color' => $row->color,
            'order' => $row->order_index,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
