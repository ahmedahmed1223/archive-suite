<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class SyncController extends Controller
{
    // ponytail: "conflict" here just flags rows never round-tripped through a
    // versioned bulk sync (null sync_version). Upgrade to real multi-writer
    // conflict detection (version mismatch on write) if concurrent sync agents
    // become real.
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $limit = (int) ($validated['limit'] ?? 200);
        $page = (int) ($validated['page'] ?? 1);

        $paginated = DB::table('storage_rows')
            ->orderByDesc('updated_at')
            ->paginate($limit, ['*'], 'page', $page);

        $entries = collect($paginated->items())->map(fn (stdClass $row): array => $this->formatEntry($row))->values();

        // ponytail: summary counts are computed across ALL rows (not just this
        // page) so "total"/"conflicts" stay correct once results are paginated
        // — the old code silently reported the current page's count as the
        // grand total once row count exceeded the limit.
        $totalRows = $paginated->total();
        $totalConflicts = DB::table('storage_rows')->whereNull('sync_version')->count();

        return response()->json([
            'ok' => true,
            'entries' => $entries,
            'summary' => [
                'total' => $totalRows,
                'synced' => $totalRows - $totalConflicts,
                'conflicts' => $totalConflicts,
            ],
            'pagination' => [
                'total' => $totalRows,
                'page' => $paginated->currentPage(),
                'limit' => $limit,
                'hasMore' => $paginated->hasMorePages(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatEntry(stdClass $row): array
    {
        $lastModifiedBy = $row->last_modified_by;
        if (is_string($lastModifiedBy)) {
            $lastModifiedBy = json_decode($lastModifiedBy, true);
        }

        $syncVersion = $row->sync_version;
        if (is_string($syncVersion)) {
            $syncVersion = (int) $syncVersion;
        }

        return [
            'uid' => $row->uid,
            'store' => $row->store,
            'status' => $syncVersion === null ? 'conflict' : 'synced',
            'syncVersion' => $syncVersion,
            'lastModifiedBy' => $lastModifiedBy ?: null,
            'updatedAt' => $row->updated_at,
        ];
    }
}
