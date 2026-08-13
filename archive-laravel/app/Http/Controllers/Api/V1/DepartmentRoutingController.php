<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class DepartmentRoutingController extends Controller
{
    public function preview(Request $request, string $id): JsonResponse
    {
        $item = $this->item($request, $id);
        if (! $item) {
            return $this->notFound();
        }

        $validated = $request->validate(['departmentId' => ['required', 'string', 'max:100']]);

        return response()->json(['ok' => true, ...$this->decision($item, $validated['departmentId'])]);
    }

    public function apply(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $item = $this->item($request, $id);
        if (! $item) {
            return $this->notFound();
        }

        $validated = $request->validate(['departmentId' => ['required', 'string', 'max:100']]);
        $decision = $this->decision($item, $validated['departmentId']);
        if ($decision['blocked']) {
            return response()->json(['ok' => false, 'code' => 'department_routing_blocked', ...$decision], 422);
        }
        $history = $this->history($item->routing_history);
        $history[] = ['from' => $item->department_id, 'to' => $validated['departmentId'], 'at' => now()->toISOString()];
        DB::table('inbox_items')->where('id', $id)->update([
            'department_id' => $validated['departmentId'],
            'routing_history' => json_encode($history),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'departmentId' => $validated['departmentId'], 'routingHistory' => $history]);
    }

    private function item(Request $request, string $id): ?object
    {
        return DB::table('inbox_items')->where('id', $id)->where('user_id', $request->attributes->get('archive_user')?->getKey())->first();
    }

    /** @return array{blocked: bool, reason: string|null, fromDepartmentId: string|null, toDepartmentId: string} */
    private function decision(object $item, string $target): array
    {
        $history = $this->history($item->routing_history);
        $seen = array_filter(array_merge([$item->department_id], array_column($history, 'from'), array_column($history, 'to')));
        $blocked = $target === $item->department_id || in_array($target, $seen, true) || count($history) >= 8;

        return [
            'blocked' => $blocked,
            'reason' => $blocked ? 'Department was already routed in this chain.' : null,
            'fromDepartmentId' => $item->department_id,
            'toDepartmentId' => $target,
        ];
    }

    /** @return array<int, array{from: string|null, to: string, at: string}> */
    private function history(mixed $value): array
    {
        $history = is_string($value) ? json_decode($value, true) : $value;

        return is_array($history) ? array_values($history) : [];
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Inbox item not found.', 'code' => 'not_found'], 404);
    }
}
