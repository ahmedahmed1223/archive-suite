<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ArchivalNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ArchivalNodesController extends Controller
{
    /** @var list<string> */
    private const LEVELS = ['institution', 'fonds', 'series', 'program', 'season', 'episode', 'item', 'segment'];

    public function index(): JsonResponse
    {
        $nodes = ArchivalNode::query()->orderBy('parent_id')->orderBy('position')->orderBy('title')->get();
        $byId = $nodes->keyBy('id');

        return response()->json(['ok' => true, 'nodes' => $nodes->map(fn (ArchivalNode $node): array => $this->payload($node, $byId->all()))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'level' => ['required', 'string', 'in:'.implode(',', self::LEVELS)],
            'parentId' => ['nullable', 'uuid'],
            'referenceCode' => ['nullable', 'string', 'max:200'],
            'recordStore' => ['nullable', 'string', 'max:200'],
            'recordUid' => ['nullable', 'string', 'max:200'],
        ]);

        $parentId = $data['parentId'] ?? null;
        if ($parentId !== null && ! ArchivalNode::query()->whereKey($parentId)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Parent archival node not found.', 'code' => 'parent_not_found'], 422);
        }

        $node = ArchivalNode::query()->create([
            'id' => (string) Str::uuid(),
            'parent_id' => $parentId,
            'title' => trim($data['title']),
            'level' => $data['level'],
            'reference_code' => $data['referenceCode'] ?? null,
            'record_store' => $data['recordStore'] ?? null,
            'record_uid' => $data['recordUid'] ?? null,
            'position' => ((int) ArchivalNode::query()->where('parent_id', $parentId)->max('position')) + 1,
            'created_by' => $request->attributes->get('archive_user')?->getKey(),
        ]);

        return response()->json(['ok' => true, 'node' => $this->payload($node, [$node->id => $node])], 201);
    }

    public function movePreview(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $node = ArchivalNode::query()->find($id);
        if (! $node) {
            return response()->json(['ok' => false, 'error' => 'Archival node not found.', 'code' => 'not_found'], 404);
        }
        $data = $request->validate(['parentId' => ['nullable', 'uuid']]);
        $parentId = $data['parentId'] ?? null;

        if ($parentId === $node->id || ($parentId !== null && $this->isDescendant($parentId, $node->id))) {
            return response()->json(['ok' => false, 'error' => 'An archival node cannot move into itself or one of its descendants.', 'code' => 'cycle_detected'], 422);
        }
        if ($parentId !== null && ! ArchivalNode::query()->whereKey($parentId)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Parent archival node not found.', 'code' => 'parent_not_found'], 422);
        }

        return response()->json([
            'ok' => true,
            'preview' => [
                'nodeId' => $node->id,
                'parentId' => $parentId,
                'affectedDescendantCount' => $this->descendantCount($node->id),
            ],
        ]);
    }

    /** @param array<string, ArchivalNode> $byId @return array<string, mixed> */
    private function payload(ArchivalNode $node, array $byId): array
    {
        $path = [];
        $cursor = $node;
        while ($cursor->parent_id !== null && isset($byId[$cursor->parent_id])) {
            $cursor = $byId[$cursor->parent_id];
            array_unshift($path, ['id' => $cursor->id, 'title' => $cursor->title, 'level' => $cursor->level]);
        }

        return [
            'id' => $node->id, 'parentId' => $node->parent_id, 'level' => $node->level, 'title' => $node->title,
            'referenceCode' => $node->reference_code, 'position' => $node->position,
            'recordStore' => $node->record_store, 'recordUid' => $node->record_uid, 'path' => $path,
        ];
    }

    private function isDescendant(string $candidateId, string $ancestorId): bool
    {
        $cursor = ArchivalNode::query()->find($candidateId);
        while ($cursor && $cursor->parent_id !== null) {
            if ($cursor->parent_id === $ancestorId) return true;
            $cursor = ArchivalNode::query()->find($cursor->parent_id);
        }
        return false;
    }

    private function descendantCount(string $nodeId): int
    {
        $pending = [$nodeId];
        $count = 0;
        while ($pending !== []) {
            $children = ArchivalNode::query()->whereIn('parent_id', $pending)->pluck('id')->all();
            $count += count($children);
            $pending = $children;
        }
        return $count;
    }
}
