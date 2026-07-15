<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use JsonException;
use stdClass;

/**
 * V1-731 (B07): browsable, restorable trash.
 *
 * RecordsController::bulkDelete() moves rows here instead of destroying them;
 * this controller browses, restores, and (admin-only) permanently destroys
 * them. trash:prune drops entries past the retention window.
 */
class TrashController extends Controller
{
    /**
     * @throws ValidationException
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store' => ['nullable', 'string'],
            'q' => ['nullable', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);
        $page = (int) ($validated['page'] ?? 1);
        $term = isset($validated['q']) ? trim((string) $validated['q']) : '';

        $query = DB::table('trashed_records')
            ->when(isset($validated['store']), fn ($q) => $q->where('store', $validated['store']))
            ->when($term !== '', function ($q) use ($term): void {
                // ponytail: LIKE over uid + the raw JSON payload. The store is
                // schemaless, so there is no title column to index; swap for
                // the FTS index SearchController uses if trash search gets hot.
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($term)).'%';
                $q->where(function ($inner) use ($like): void {
                    $inner->whereRaw('LOWER(uid) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(data) LIKE ?', [$like]);
                });
            })
            ->orderByDesc('deleted_at')
            ->orderBy('id');

        $paginated = $query->paginate($limit, ['*'], 'page', $page);

        $items = collect($paginated->items())
            ->map(fn (stdClass $row): array => $this->formatEntry($row))
            ->values();

        return response()->json([
            'ok' => true,
            'items' => $items,
            'pagination' => [
                'total' => $paginated->total(),
                'page' => $paginated->currentPage(),
                'limit' => $limit,
                'hasMore' => $paginated->hasMorePages(),
            ],
        ]);
    }

    /**
     * Restore trashed records to their prior state.
     *
     * requireEditor: restoring re-creates content, the same `manage-content`
     * write that deleting it was, and the role that deleted it should be able
     * to undo it without escalating to an admin.
     *
     * @throws ValidationException
     * @throws JsonException
     */
    public function restore(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $this->validateTargets($request);
        $results = [];
        $count = 0;

        foreach (array_values(array_unique($validated['ids'])) as $id) {
            $entry = DB::table('trashed_records')
                ->where('store', $validated['store'])
                ->where('uid', $id)
                ->first();

            if (! $entry instanceof stdClass) {
                $results[] = ['uid' => $id, 'restored' => false, 'reason' => 'not_found'];

                continue;
            }

            $liveExists = DB::table('storage_rows')
                ->where('store', $entry->store)
                ->where('uid', $entry->uid)
                ->exists();

            if ($liveExists) {
                // A record with this uid was recreated while the old one sat in
                // the trash. Restoring would silently overwrite live data, so
                // refuse and leave the trash entry recoverable.
                $results[] = ['uid' => $id, 'restored' => false, 'reason' => 'conflict'];

                continue;
            }

            DB::transaction(function () use ($entry): void {
                DB::table('storage_rows')->insert([
                    'store' => $entry->store,
                    'uid' => $entry->uid,
                    'data' => $entry->data,
                    'sync_version' => $entry->sync_version,
                    'last_modified_by' => $entry->last_modified_by,
                    'created_at' => $entry->original_created_at,
                    'updated_at' => $entry->original_updated_at,
                ]);

                DB::table('trashed_records')->where('id', $entry->id)->delete();
            });

            $results[] = ['uid' => $id, 'restored' => true];
            $count++;
        }

        return response()->json(['ok' => true, 'count' => $count, 'results' => $results]);
    }

    /**
     * Permanently destroy trashed records.
     *
     * requireAdmin: this is the only irreversible step. Editors keep
     * bulk-delete precisely because it is now recoverable; destroying the last
     * copy is a higher bar than putting it in the bin.
     *
     * @throws ValidationException
     */
    public function purge(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $this->validateTargets($request);
        $results = [];
        $count = 0;

        foreach (array_values(array_unique($validated['ids'])) as $id) {
            $purged = DB::table('trashed_records')
                ->where('store', $validated['store'])
                ->where('uid', $id)
                ->delete();

            $results[] = ['uid' => $id, 'purged' => $purged > 0];

            if ($purged > 0) {
                $count++;
            }
        }

        return response()->json(['ok' => true, 'count' => $count, 'results' => $results]);
    }

    /**
     * Move a storage_rows row into the trash. Called by RecordsController.
     *
     * @throws JsonException
     */
    public static function trashRow(stdClass $row, ?User $actor): void
    {
        DB::table('trashed_records')->updateOrInsert(
            ['store' => $row->store, 'uid' => $row->uid],
            [
                'data' => $row->data,
                'sync_version' => $row->sync_version,
                'last_modified_by' => $row->last_modified_by,
                'original_created_at' => $row->created_at,
                'original_updated_at' => $row->updated_at,
                'deleted_at' => now(),
                'deleted_by' => $actor?->id,
            ],
        );
    }

    /**
     * @return array{store: string, ids: array<int, string>}
     *
     * @throws ValidationException
     */
    private function validateTargets(Request $request): array
    {
        /** @var array{store: string, ids: array<int, string>} $validated */
        $validated = $request->validate([
            'store' => ['required', 'string'],
            'ids' => ['required', 'array', 'min:1', 'max:10000'],
            'ids.*' => ['required', 'string'],
        ]);

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatEntry(stdClass $row): array
    {
        return [
            'id' => (int) $row->id,
            'store' => $row->store,
            'uid' => $row->uid,
            'record' => json_decode((string) $row->data, true) ?: [],
            'syncVersion' => $row->sync_version,
            'deletedAt' => $row->deleted_at,
            'deletedBy' => $row->deleted_by,
            'originalCreatedAt' => $row->original_created_at,
            'originalUpdatedAt' => $row->original_updated_at,
        ];
    }
}
