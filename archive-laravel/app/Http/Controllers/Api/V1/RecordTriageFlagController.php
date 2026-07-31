<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

// V1-837: quick-triage "needs info" flag — one per record, team-visible.
// Accept/tag/defer are already covered by workflow status, tags, and the
// later-list (V1-842); this is the one genuinely missing triage signal.
class RecordTriageFlagController extends Controller
{
    public function show(string $recordId): JsonResponse
    {
        $flag = DB::table('record_triage_flags')->where('record_id', $recordId)->first();

        return response()->json(['ok' => true, 'flag' => $flag ? $this->formatFlag($flag) : null]);
    }

    public function upsert(Request $request, string $recordId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:1', 'max:2000'],
        ]);

        $user = $request->attributes->get('archive_user');
        $now = now();
        DB::table('record_triage_flags')->updateOrInsert(
            ['record_id' => $recordId],
            ['reason' => $validated['reason'], 'flagged_by' => $user?->getKey(), 'updated_at' => $now, 'created_at' => $now]
        );

        $flag = DB::table('record_triage_flags')->where('record_id', $recordId)->first();

        return response()->json(['ok' => true, 'flag' => $this->formatFlag($flag)]);
    }

    public function destroy(string $recordId): JsonResponse
    {
        $deleted = DB::table('record_triage_flags')->where('record_id', $recordId)->delete();

        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Triage flag not found.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatFlag(stdClass $flag): array
    {
        return [
            'recordId' => $flag->record_id,
            'reason' => $flag->reason,
            'flaggedBy' => $flag->flagged_by,
            'createdAt' => $flag->created_at,
            'updatedAt' => $flag->updated_at,
        ];
    }
}
