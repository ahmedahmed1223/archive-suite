<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

// V1-848: a light, time-limited edit claim — informational only, never blocks
// a save on its own. Documented override: any authenticated editor can claim
// over an expired or another user's claim; the real conflict guard remains
// the client's syncVersion check at save time.
class RecordEditClaimController extends Controller
{
    private const TTL_MINUTES = 5;

    public function show(string $recordId): JsonResponse
    {
        $claim = $this->activeClaim($recordId);

        return response()->json(['ok' => true, 'claim' => $claim ? $this->format($claim) : null]);
    }

    public function claim(Request $request, string $recordId): JsonResponse
    {
        $user = $request->attributes->get('archive_user');
        $now = now();
        $expiresAt = $now->copy()->addMinutes(self::TTL_MINUTES);

        DB::table('record_edit_claims')->updateOrInsert(
            ['record_id' => $recordId],
            [
                'claimed_by' => $user?->getKey(),
                'claimed_by_name' => $user?->name ?? $user?->email ?? 'مجهول',
                'expires_at' => $expiresAt,
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );

        $claim = DB::table('record_edit_claims')->where('record_id', $recordId)->first();

        return response()->json(['ok' => true, 'claim' => $this->format($claim)]);
    }

    public function release(Request $request, string $recordId): JsonResponse
    {
        DB::table('record_edit_claims')->where('record_id', $recordId)->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    private function activeClaim(string $recordId): ?stdClass
    {
        $row = DB::table('record_edit_claims')
            ->where('record_id', $recordId)
            ->where('expires_at', '>', now())
            ->first();

        return $row instanceof stdClass ? $row : null;
    }

    /** @return array<string, mixed> */
    private function format(stdClass $claim): array
    {
        return [
            'recordId' => $claim->record_id,
            'claimedBy' => $claim->claimed_by,
            'claimedByName' => $claim->claimed_by_name,
            'expiresAt' => $claim->expires_at,
        ];
    }
}
