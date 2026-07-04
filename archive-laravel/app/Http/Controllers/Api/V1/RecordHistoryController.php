<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class RecordHistoryController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    public function index(Request $request, string $recordId): JsonResponse
    {
        if (! $this->recordExists($recordId)) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 100);

        $entries = DB::table('audit_logs')
            ->where('resource_id', $recordId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (stdClass $row): array => $this->formatEntry($row))
            ->values();

        return response()->json(['ok' => true, 'entries' => $entries]);
    }

    private function recordExists(string $id): bool
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->where(function ($query) use ($id): void {
                $query->where('uid', $id)
                    ->orWhere('data->>\'id\'', $id);
            })
            ->exists();
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
