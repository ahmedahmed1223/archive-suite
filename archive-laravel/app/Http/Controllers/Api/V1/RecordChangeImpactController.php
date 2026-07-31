<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class RecordChangeImpactController extends Controller
{
    public function preview(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $request->validate(['operation' => ['required', 'in:update,delete']]);
        $relations = DB::table('record_relations')->where('source_record_id', $id)->orWhere('target_record_id', $id)->get()->map(fn ($r) => ['id' => $r->id, 'type' => $r->type])->all();
        $shares = DB::table('share_links')->where('record_id', $id)->count();
        $segments = DB::table('record_segments')->where('record_id', $id)->count();
        $blocked = $request->string('operation')->toString() === 'delete' && $relations !== [];
        return response()->json(['ok' => true, 'blocked' => $blocked, 'relations' => $relations, 'shares' => $shares, 'segments' => $segments, 'reports' => 0, 'reason' => $blocked ? 'unresolved_relations' : null]);
    }
}
