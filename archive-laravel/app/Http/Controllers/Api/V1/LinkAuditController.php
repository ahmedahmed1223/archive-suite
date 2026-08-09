<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use stdClass;

// V1-841: read-only scan for record relations pointing at a record that no
// longer exists — no new storage, cross-references the existing
// record_relations and storage_rows tables.
class LinkAuditController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    public function index(): JsonResponse
    {
        $relations = DB::table('record_relations')->orderBy('created_at')->get();
        $cache = [];
        $exists = function (string $id) use (&$cache): bool {
            if (! array_key_exists($id, $cache)) {
                $cache[$id] = DB::table('storage_rows')
                    ->where('store', self::ARCHIVE_STORE)
                    ->where(function ($query) use ($id): void {
                        $query->where('uid', $id)->orWhereRaw("data->>'id' = ?", [$id]);
                    })
                    ->exists();
            }

            return $cache[$id];
        };

        $broken = $relations
            ->filter(fn (stdClass $r) => ! $exists($r->source_record_id) || ! $exists($r->target_record_id))
            ->map(fn (stdClass $r) => [
                'relationId' => $r->id,
                'sourceRecordId' => $r->source_record_id,
                'targetRecordId' => $r->target_record_id,
                'missingSource' => ! $exists($r->source_record_id),
                'missingTarget' => ! $exists($r->target_record_id),
            ])
            ->values();

        return response()->json(['ok' => true, 'brokenLinks' => $broken]);
    }
}
