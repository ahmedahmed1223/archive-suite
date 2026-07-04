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
        ]);

        $limit = (int) ($validated['limit'] ?? 200);

        $rows = DB::table('storage_rows')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get();

        $entries = $rows->map(fn (stdClass $row): array => $this->formatEntry($row))->values();
        $conflicts = $entries->filter(fn (array $entry): bool => $entry['status'] === 'conflict')->count();

        return response()->json([
            'ok' => true,
            'entries' => $entries,
            'summary' => [
                'total' => $entries->count(),
                'synced' => $entries->count() - $conflicts,
                'conflicts' => $conflicts,
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
