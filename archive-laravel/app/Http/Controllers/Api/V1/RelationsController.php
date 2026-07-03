<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

class RelationsController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    /**
     * @var array<string, array{label: string, inverse: string, bidirectional: bool}>
     */
    private const RELATION_TYPES = [
        'is_part_of' => ['label' => 'جزء من', 'inverse' => 'contains', 'bidirectional' => false],
        'contains' => ['label' => 'يحتوي على', 'inverse' => 'is_part_of', 'bidirectional' => false],
        'references' => ['label' => 'يشير إلى', 'inverse' => 'referenced_by', 'bidirectional' => false],
        'depends_on' => ['label' => 'يعتمد على', 'inverse' => 'required_by', 'bidirectional' => false],
        'related_to' => ['label' => 'مرتبط بـ', 'inverse' => 'related_to', 'bidirectional' => true],
        'alternative_of' => ['label' => 'بديل عن', 'inverse' => 'alternative_of', 'bidirectional' => true],
        'copy_of' => ['label' => 'نسخة من', 'inverse' => 'has_copy', 'bidirectional' => false],
        'precedes' => ['label' => 'يسبق', 'inverse' => 'follows', 'bidirectional' => false],
        'follows' => ['label' => 'يتبع', 'inverse' => 'precedes', 'bidirectional' => false],
    ];

    /**
     * @var array<string, string>
     */
    private const INVERSE_LABELS = [
        'referenced_by' => 'مشار إليه من',
        'required_by' => 'مطلوب لـ',
        'has_copy' => 'له نسخة',
    ];

    public function graph(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recordId' => ['nullable', 'string', 'max:255'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 120);
        $focusId = isset($validated['recordId']) ? trim((string) $validated['recordId']) : '';
        $records = $this->archiveRecords();
        $relations = DB::table('record_relations')
            ->orderByDesc('updated_at')
            ->get()
            ->all();

        $graph = $this->buildGraph($records, $relations, $focusId, $limit);

        return response()->json([
            'ok' => true,
            ...$graph,
            'relationTypes' => $this->relationTypeOptions(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sourceId' => ['required', 'string', 'max:255'],
            'targetId' => ['required', 'string', 'max:255', 'different:sourceId'],
            'type' => ['required', 'string', Rule::in(array_keys(self::RELATION_TYPES))],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        if (! $this->recordExists($validated['sourceId']) || ! $this->recordExists($validated['targetId'])) {
            return response()->json([
                'ok' => false,
                'error' => 'Cannot create a relation for missing archive records.',
                'code' => 'record_not_found',
            ], 404);
        }

        $existing = DB::table('record_relations')
            ->where('source_record_id', $validated['sourceId'])
            ->where('target_record_id', $validated['targetId'])
            ->where('type', $validated['type'])
            ->first();

        if ($existing instanceof stdClass) {
            return response()->json([
                'ok' => true,
                'relation' => $this->formatRelation($existing),
            ]);
        }

        $now = now();
        $id = (string) Str::uuid();

        DB::table('record_relations')->insert([
            'id' => $id,
            'source_record_id' => $validated['sourceId'],
            'target_record_id' => $validated['targetId'],
            'type' => $validated['type'],
            'note' => $validated['note'] ?? null,
            'metadata' => null,
            'created_by' => $request->attributes->get('archive_user')?->getKey(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $relation = DB::table('record_relations')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'relation' => $this->formatRelation($relation),
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $deleted = DB::table('record_relations')->where('id', $id)->delete();

        if ($deleted < 1) {
            return response()->json([
                'ok' => false,
                'error' => 'Relation not found.',
                'code' => 'not_found',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'deleted' => true,
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function archiveRecords(): array
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row))
            ->values()
            ->all();
    }

    private function recordExists(string $id): bool
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->where(function ($query) use ($id): void {
                $query->where('uid', $id)
                    ->orWhere('data->>\'id\'', $id);
            })
            ->exists();
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @param array<int, stdClass> $relations
     * @return array{nodes: array<int, array<string, mixed>>, edges: array<int, array<string, mixed>>, stats: array<string, int|string|null>}
     */
    private function buildGraph(array $records, array $relations, string $focusId, int $limit): array
    {
        $nodesById = [];
        $aliases = [];

        foreach ($records as $record) {
            $id = $this->recordId($record);
            if ($id === '') {
                continue;
            }

            $nodesById[$id] = [
                'id' => $id,
                'uid' => (string) ($record['uid'] ?? $id),
                'label' => (string) ($record['title'] ?? $record['name'] ?? $id),
                'kind' => 'item',
                'type' => (string) ($record['type'] ?? $record['subtype'] ?? 'record'),
                'tags' => array_values(array_filter(array_map('strval', (array) ($record['tags'] ?? [])))),
                'degree' => 0,
                'record' => $record,
            ];

            $aliases[$id] = $id;
            if (isset($record['uid'])) {
                $aliases[(string) $record['uid']] = $id;
            }
        }

        $edges = [];
        $edgeKeys = [];

        foreach ($relations as $relation) {
            $source = $aliases[(string) $relation->source_record_id] ?? null;
            $target = $aliases[(string) $relation->target_record_id] ?? null;

            if (! $source || ! $target || $source === $target) {
                continue;
            }

            $edge = [
                'id' => 'rel:'.$relation->id,
                'relationId' => $relation->id,
                'source' => $source,
                'target' => $target,
                'kind' => 'manual',
                'type' => $relation->type,
                'label' => $this->relationLabel((string) $relation->type),
                'weight' => 3,
                'note' => $relation->note,
                'createdAt' => $this->dateString($relation->created_at),
                'updatedAt' => $this->dateString($relation->updated_at),
            ];

            $this->addEdge($edges, $edgeKeys, $nodesById, $edge);
        }

        $this->addSharedTagEdges($records, $aliases, $nodesById, $edges, $edgeKeys);
        $this->addSharedTypeEdges($nodesById, $edges, $edgeKeys);

        $canonicalFocusId = $focusId !== '' ? ($aliases[$focusId] ?? $focusId) : '';
        if ($canonicalFocusId !== '') {
            $edges = array_values(array_filter(
                $edges,
                fn (array $edge): bool => $edge['source'] === $canonicalFocusId || $edge['target'] === $canonicalFocusId
            ));
        }

        $visibleIds = [];
        if ($canonicalFocusId !== '' && isset($nodesById[$canonicalFocusId])) {
            $visibleIds[$canonicalFocusId] = true;
        }

        foreach ($edges as $edge) {
            $visibleIds[(string) $edge['source']] = true;
            $visibleIds[(string) $edge['target']] = true;
        }

        if ($canonicalFocusId === '' && count($visibleIds) === 0) {
            foreach (array_keys($nodesById) as $id) {
                $visibleIds[$id] = true;
                if (count($visibleIds) >= $limit) {
                    break;
                }
            }
        }

        $nodes = array_values(array_intersect_key($nodesById, $visibleIds));
        usort($nodes, fn (array $left, array $right): int => ($right['degree'] <=> $left['degree']) ?: strcmp($left['label'], $right['label']));

        if (count($nodes) > $limit) {
            $allowed = array_flip(array_column(array_slice($nodes, 0, $limit), 'id'));
            if ($canonicalFocusId !== '') {
                $allowed[$canonicalFocusId] = true;
            }
            $nodes = array_values(array_filter($nodes, fn (array $node): bool => isset($allowed[$node['id']])));
            $edges = array_values(array_filter($edges, fn (array $edge): bool => isset($allowed[$edge['source']], $allowed[$edge['target']])));
        }

        $manualCount = count(array_filter($edges, fn (array $edge): bool => $edge['kind'] === 'manual'));

        return [
            'nodes' => $nodes,
            'edges' => $edges,
            'stats' => [
                'nodeCount' => count($nodes),
                'edgeCount' => count($edges),
                'manualEdgeCount' => $manualCount,
                'inferredEdgeCount' => count($edges) - $manualCount,
                'focusId' => $canonicalFocusId !== '' ? $canonicalFocusId : null,
            ],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @param array<string, string> $aliases
     * @param array<string, array<string, mixed>> $nodesById
     * @param array<int, array<string, mixed>> $edges
     * @param array<string, true> $edgeKeys
     */
    private function addSharedTagEdges(array $records, array $aliases, array &$nodesById, array &$edges, array &$edgeKeys): void
    {
        $groups = [];

        foreach ($records as $record) {
            $id = $aliases[$this->recordId($record)] ?? null;
            if (! $id) {
                continue;
            }

            foreach ((array) ($record['tags'] ?? []) as $tag) {
                $normalized = $this->normalizeTag($tag);
                if ($normalized === '') {
                    continue;
                }
                $groups[$normalized]['label'] = trim((string) $tag);
                $groups[$normalized]['ids'][$id] = true;
            }
        }

        $pairs = [];
        foreach ($groups as $group) {
            $ids = array_keys($group['ids'] ?? []);
            for ($i = 0; $i < count($ids); $i++) {
                for ($j = $i + 1; $j < count($ids); $j++) {
                    $key = $this->pairKey($ids[$i], $ids[$j]);
                    $pairs[$key]['ids'] = [$ids[$i], $ids[$j]];
                    $pairs[$key]['tags'][] = $group['label'];
                }
            }
        }

        foreach ($pairs as $pair) {
            [$source, $target] = $pair['ids'];
            $sharedTags = array_values(array_unique($pair['tags']));
            $this->addEdge($edges, $edgeKeys, $nodesById, [
                'id' => 'tag:'.$this->pairKey($source, $target),
                'source' => $source,
                'target' => $target,
                'kind' => 'shared-tag',
                'type' => 'shared_tag',
                'label' => 'وسوم مشتركة',
                'weight' => max(1, count($sharedTags)),
                'sharedTags' => array_slice($sharedTags, 0, 8),
            ]);
        }
    }

    /**
     * @param array<string, array<string, mixed>> $nodesById
     * @param array<int, array<string, mixed>> $edges
     * @param array<string, true> $edgeKeys
     */
    private function addSharedTypeEdges(array &$nodesById, array &$edges, array &$edgeKeys): void
    {
        $idsByType = [];
        foreach ($nodesById as $id => $node) {
            $type = trim((string) ($node['type'] ?? ''));
            if ($type === '') {
                continue;
            }
            $idsByType[$type][] = $id;
        }

        foreach ($idsByType as $type => $ids) {
            $ids = array_slice(array_values(array_unique($ids)), 0, 24);
            for ($i = 0; $i < count($ids); $i++) {
                for ($j = $i + 1; $j < count($ids); $j++) {
                    $this->addEdge($edges, $edgeKeys, $nodesById, [
                        'id' => 'type:'.$this->pairKey($ids[$i], $ids[$j]),
                        'source' => $ids[$i],
                        'target' => $ids[$j],
                        'kind' => 'same-type',
                        'type' => 'same_type',
                        'label' => 'نوع مشترك',
                        'weight' => 1,
                        'sharedType' => $type,
                    ]);
                }
            }
        }
    }

    /**
     * @param array<int, array<string, mixed>> $edges
     * @param array<string, true> $edgeKeys
     * @param array<string, array<string, mixed>> $nodesById
     * @param array<string, mixed> $edge
     */
    private function addEdge(array &$edges, array &$edgeKeys, array &$nodesById, array $edge): void
    {
        if (! isset($nodesById[$edge['source']], $nodesById[$edge['target']]) || isset($edgeKeys[$edge['id']])) {
            return;
        }

        $edgeKeys[$edge['id']] = true;
        $edges[] = $edge;
        $nodesById[$edge['source']]['degree']++;
        $nodesById[$edge['target']]['degree']++;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function recordId(array $record): string
    {
        return trim((string) ($record['id'] ?? $record['uid'] ?? ''));
    }

    private function pairKey(string $left, string $right): string
    {
        return strcmp($left, $right) <= 0 ? $left.'|'.$right : $right.'|'.$left;
    }

    private function normalizeTag(mixed $tag): string
    {
        return mb_strtolower(trim((string) $tag));
    }

    private function relationLabel(string $type): string
    {
        return self::RELATION_TYPES[$type]['label'] ?? self::INVERSE_LABELS[$type] ?? $type;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function relationTypeOptions(): array
    {
        $options = [];
        foreach (self::RELATION_TYPES as $key => $type) {
            $options[] = [
                'key' => $key,
                'label' => $type['label'],
                'inverse' => $type['inverse'],
                'bidirectional' => $type['bidirectional'],
            ];
        }

        return $options;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRelation(?stdClass $relation): array
    {
        if (! $relation) {
            return [];
        }

        return [
            'id' => $relation->id,
            'sourceId' => $relation->source_record_id,
            'targetId' => $relation->target_record_id,
            'type' => $relation->type,
            'label' => $this->relationLabel((string) $relation->type),
            'note' => $relation->note,
            'createdAt' => $this->dateString($relation->created_at),
            'updatedAt' => $this->dateString($relation->updated_at),
        ];
    }

    private function dateString(mixed $value): ?string
    {
        return $value ? (string) $value : null;
    }
}
