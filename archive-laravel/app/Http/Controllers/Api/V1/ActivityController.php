<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class ActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
            'event' => ['nullable', 'string', 'max:120'],
            'resourceType' => ['nullable', 'string', 'max:120'],
            'resourceId' => ['nullable', 'string', 'max:255'],
            'outcome' => ['nullable', 'in:success,rejected,failed'],
        ]);

        $limit = (int) ($validated['limit'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);

        $query = DB::table('audit_logs')->orderByDesc('created_at');

        if (! empty($validated['event'])) {
            $query->where('event', $validated['event']);
        }

        if (! empty($validated['resourceType'])) {
            $query->where('resource_type', $validated['resourceType']);
        }

        if (! empty($validated['resourceId'])) {
            $query->where('resource_id', $validated['resourceId']);
        }

        if (! empty($validated['outcome'])) {
            $query->where('outcome', $validated['outcome']);
        }

        $paginated = $query->paginate($limit, ['*'], 'page', $page);

        $entries = collect($paginated->items())
            ->map(fn (stdClass $row): array => $this->formatEntry($row))
            ->values();

        return response()->json([
            'ok' => true,
            'entries' => $entries,
            'filters' => [
                'event' => $validated['event'] ?? null,
                'resourceType' => $validated['resourceType'] ?? null,
                'resourceId' => $validated['resourceId'] ?? null,
                'outcome' => $validated['outcome'] ?? null,
                'limit' => $limit,
            ],
            'pagination' => [
                'total' => $paginated->total(),
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
        $metadata = $row->metadata;
        if (is_string($metadata)) {
            $metadata = json_decode($metadata, true);
        }

        return [
            'id' => $row->id,
            'event' => $row->event,
            'action' => $row->action,
            'resourceType' => $row->resource_type,
            'resourceId' => $row->resource_id,
            'actorId' => $row->actor_id,
            'outcome' => $row->outcome,
            'statusCode' => $row->status_code,
            'metadata' => $metadata ?: null,
            'createdAt' => $row->created_at,
        ];
    }
}
