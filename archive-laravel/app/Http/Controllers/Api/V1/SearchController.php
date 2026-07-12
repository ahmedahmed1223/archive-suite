<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Search\EmbeddingService;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use stdClass;

class SearchController extends Controller
{
    public function __construct(private readonly EmbeddingService $embeddings)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string'],
            'store' => ['nullable', 'string'],
            'type' => ['nullable', 'string'],
            'subtype' => ['nullable', 'string'],
            'tag' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'workflowStatus' => ['nullable', 'string'],
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            // ponytail: not validated as `boolean` — that rule only accepts
            // true/false/0/1/"0"/"1", so a real `?semantic=true` query string
            // would 422. $request->boolean() below handles "true"/"false" too.
            'semantic' => ['nullable', 'string'],
        ]);

        $limit = (int) ($validated['limit'] ?? 20);
        $queryText = trim((string) ($validated['q'] ?? ''));
        $wantsSemantic = $request->boolean('semantic');

        if ($wantsSemantic) {
            $semanticResponse = $this->semanticSearch($queryText, $validated['store'] ?? null, $limit, $validated);
            if ($semanticResponse !== null) {
                return response()->json($semanticResponse);
            }
        }

        $cursorUid = isset($validated['cursor']) ? StorageRowPayload::decodeCursor($validated['cursor']) : null;

        $query = DB::table('storage_rows')
            ->orderBy('uid');

        if (isset($validated['store'])) {
            $query->where('store', $validated['store']);
        }

        if ($queryText !== '') {
            $query->where('data', 'like', '%'.$this->escapeLike($queryText).'%');
        }

        $records = $query
            ->get()
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row))
            ->filter(fn (array $record): bool => $this->matchesFilters($record, $validated))
            ->values();

        $facets = $this->buildFacets($records, $validated, $wantsSemantic ? 'keyword-fallback' : 'keyword');

        $pageRecords = $records
            ->filter(fn (array $record): bool => $cursorUid === null || strcmp((string) ($record['uid'] ?? $record['id'] ?? ''), $cursorUid) > 0)
            ->values();

        $hasMore = $pageRecords->count() > $limit;
        $pageRecords = $pageRecords->take($limit)->values();
        $lastRecord = $pageRecords->last();

        return response()->json([
            'ok' => true,
            'records' => $pageRecords,
            'facets' => $facets,
            'nextCursor' => $hasMore && is_array($lastRecord) ? StorageRowPayload::encodeCursor((string) ($lastRecord['uid'] ?? $lastRecord['id'] ?? '')) : null,
        ]);
    }

    /**
     * Attempts a pgvector nearest-neighbor search and shapes it into the same
     * response envelope as the keyword path. Returns null whenever semantic
     * search can't actually run (disabled/misconfigured/embed failure) so
     * the caller falls back to the existing keyword-fallback behavior.
     *
     * ponytail: cursor here is a plain offset into the ranked pool, not a uid
     * — simplest correct pagination for a ranked (non-sorted-by-key) list.
     * Deep pagination beyond the pool size falls off; fine for a search UI.
     *
     * @param array<string, mixed> $validated
     * @return array<string, mixed>|null
     */
    private function semanticSearch(string $queryText, ?string $store, int $limit, array $validated): ?array
    {
        $poolSize = max($limit * 5, 100);
        $orderedUids = $this->embeddings->search($queryText, $store, $poolSize);

        if ($orderedUids === null) {
            return null;
        }

        $rowsByUid = DB::table('storage_rows')
            ->whereIn('uid', $orderedUids)
            ->when($store !== null, fn ($query) => $query->where('store', $store))
            ->get()
            ->keyBy('uid');

        $records = collect($orderedUids)
            ->map(fn (string $uid): mixed => $rowsByUid->get($uid))
            ->filter(fn (mixed $row): bool => $row instanceof stdClass)
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row))
            ->filter(fn (array $record): bool => $this->matchesFilters($record, $validated))
            ->values();

        $facets = $this->buildFacets($records, $validated, 'semantic');

        $offset = 0;
        if (isset($validated['cursor'])) {
            $decoded = StorageRowPayload::decodeCursor($validated['cursor']);
            $offset = ctype_digit($decoded) ? (int) $decoded : 0;
        }

        $pageRecords = $records->slice($offset, $limit)->values();
        $hasMore = ($offset + $limit) < $records->count();

        return [
            'ok' => true,
            'records' => $pageRecords,
            'facets' => $facets,
            'nextCursor' => $hasMore ? StorageRowPayload::encodeCursor((string) ($offset + $limit)) : null,
        ];
    }

    private function escapeLike(string $value): string
    {
        return addcslashes($value, '%_\\');
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, mixed> $filters
     */
    private function matchesFilters(array $record, array $filters): bool
    {
        foreach (['type', 'subtype'] as $field) {
            $value = trim((string) ($filters[$field] ?? ''));
            if ($value !== '' && trim((string) ($record[$field] ?? '')) !== $value) {
                return false;
            }
        }

        $tag = $this->normalize(trim((string) ($filters['tag'] ?? '')));
        if ($tag !== '') {
            $tags = array_map(fn (mixed $value): string => $this->normalize((string) $value), (array) ($record['tags'] ?? []));
            if (! in_array($tag, $tags, true)) {
                return false;
            }
        }

        $status = trim((string) ($filters['workflowStatus'] ?? $filters['status'] ?? ''));
        if ($status !== '' && $this->workflowStatus($record) !== $status) {
            return false;
        }

        return true;
    }

    /**
     * @param Collection<int, array<string, mixed>> $records
     * @param array<string, mixed> $validated
     * @return array<string, mixed>
     */
    private function buildFacets(Collection $records, array $validated, string $mode): array
    {
        return [
            'mode' => $mode,
            'store' => $validated['store'] ?? null,
            'total' => $records->count(),
            'stores' => $this->facetCounts($records, fn (array $record): mixed => $record['store'] ?? null),
            'types' => $this->facetCounts($records, fn (array $record): mixed => $record['type'] ?? null),
            'subtypes' => $this->facetCounts($records, fn (array $record): mixed => $record['subtype'] ?? null),
            'tags' => $this->tagFacetCounts($records),
            'statuses' => $this->facetCounts($records, fn (array $record): string => $this->workflowStatus($record), [
                'draft' => 'مسودة',
                'editing' => 'تحرير',
                'review' => 'قيد المراجعة',
                'approved' => 'معتمد',
                'published' => 'منشور',
                'archived' => 'مؤرشف',
            ]),
        ];
    }

    /**
     * @param Collection<int, array<string, mixed>> $records
     * @param callable(array<string, mixed>): mixed $extractor
     * @param array<string, string> $labels
     * @return array<int, array{value: string, label: string, count: int}>
     */
    private function facetCounts(Collection $records, callable $extractor, array $labels = []): array
    {
        $counts = [];

        foreach ($records as $record) {
            $value = trim((string) $extractor($record));
            if ($value === '') {
                continue;
            }

            $counts[$value] = ($counts[$value] ?? 0) + 1;
        }

        return $this->formatFacetCounts($counts, $labels);
    }

    /**
     * @param Collection<int, array<string, mixed>> $records
     * @return array<int, array{value: string, label: string, count: int}>
     */
    private function tagFacetCounts(Collection $records): array
    {
        $counts = [];
        $labels = [];

        foreach ($records as $record) {
            foreach ((array) ($record['tags'] ?? []) as $tag) {
                $label = trim((string) $tag);
                $value = $this->normalize($label);
                if ($value === '') {
                    continue;
                }

                $labels[$value] = $label;
                $counts[$value] = ($counts[$value] ?? 0) + 1;
            }
        }

        return $this->formatFacetCounts($counts, $labels, 30);
    }

    /**
     * @param array<string, int> $counts
     * @param array<string, string> $labels
     * @return array<int, array{value: string, label: string, count: int}>
     */
    private function formatFacetCounts(array $counts, array $labels = [], int $limit = 20): array
    {
        uksort($counts, fn (string $left, string $right): int => ($counts[$right] <=> $counts[$left]) ?: strnatcasecmp($left, $right));

        $items = [];
        foreach (array_slice($counts, 0, $limit, true) as $value => $count) {
            $items[] = [
                'value' => $value,
                'label' => $labels[$value] ?? $value,
                'count' => $count,
            ];
        }

        return $items;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function workflowStatus(array $record): string
    {
        $status = trim((string) ($record['workflowStatus'] ?? $record['status'] ?? ''));

        return $status !== '' ? $status : 'draft';
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim($value));
    }
}
