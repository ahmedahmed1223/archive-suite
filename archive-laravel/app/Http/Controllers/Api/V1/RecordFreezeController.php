<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

// V1-866: clear, cancelable lock enforced in RecordsController::bulk (the
// shared record-write path), not just hidden in the UI. Documented override:
// admins may still write to a frozen record — see bulk()'s isFrozenAndBlocked.
class RecordFreezeController extends Controller
{
    public function show(string $recordId): JsonResponse
    {
        $freeze = DB::table('record_freezes')->where('record_id', $recordId)->first();

        return response()->json(['ok' => true, 'freeze' => $freeze ? $this->format($freeze) : null]);
    }

    public function freeze(Request $request, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:1', 'max:2000'],
        ]);

        $user = $request->attributes->get('archive_user');
        $now = now();
        DB::table('record_freezes')->updateOrInsert(
            ['record_id' => $recordId],
            ['reason' => $validated['reason'], 'frozen_by' => $user?->getKey(), 'updated_at' => $now, 'created_at' => $now]
        );

        $freeze = DB::table('record_freezes')->where('record_id', $recordId)->first();

        return response()->json(['ok' => true, 'freeze' => $this->format($freeze)]);
    }

    public function unfreeze(Request $request, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $deleted = DB::table('record_freezes')->where('record_id', $recordId)->delete();

        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Record is not frozen.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function format(stdClass $freeze): array
    {
        return [
            'recordId' => $freeze->record_id,
            'reason' => $freeze->reason,
            'frozenBy' => $freeze->frozen_by,
            'createdAt' => $freeze->created_at,
        ];
    }
}
