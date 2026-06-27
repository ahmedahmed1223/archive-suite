<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class SearchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string'],
            'store' => ['nullable', 'string'],
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'semantic' => ['nullable', 'boolean'],
        ]);

        $limit = (int) ($validated['limit'] ?? 20);
        $queryText = trim((string) ($validated['q'] ?? ''));
        $cursorUid = isset($validated['cursor']) ? StorageRowPayload::decodeCursor($validated['cursor']) : null;

        $query = DB::table('storage_rows')
            ->orderBy('uid')
            ->limit($limit + 1);

        if (isset($validated['store'])) {
            $query->where('store', $validated['store']);
        }

        if ($cursorUid !== null) {
            $query->where('uid', '>', $cursorUid);
        }

        if ($queryText !== '') {
            $query->where('data', 'like', '%'.$this->escapeLike($queryText).'%');
        }

        $rows = $query->get();
        $hasMore = $rows->count() > $limit;
        $pageRows = $rows->take($limit);
        $records = $pageRows->map(fn (stdClass $row): array => StorageRowPayload::format($row))->values();
        $lastRow = $pageRows->last();

        return response()->json([
            'ok' => true,
            'records' => $records,
            'facets' => [
                'mode' => ($validated['semantic'] ?? false) ? 'keyword-fallback' : 'keyword',
                'store' => $validated['store'] ?? null,
            ],
            'nextCursor' => $hasMore && $lastRow instanceof stdClass ? StorageRowPayload::encodeCursor($lastRow->uid) : null,
        ]);
    }

    private function escapeLike(string $value): string
    {
        return addcslashes($value, '%_\\');
    }
}
