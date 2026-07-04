<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Broadcast\BroadcastMetadataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class RecordBroadcastMetadataController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    public function __construct(private readonly BroadcastMetadataService $broadcast)
    {
    }

    public function show(string $recordId): JsonResponse
    {
        if (! $this->recordExists($recordId)) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        if (! $this->broadcast->isConfigured()) {
            return response()->json([
                'ok' => true,
                'configured' => false,
                'integrations' => $this->broadcast->integrations(),
                'metadata' => null,
            ]);
        }

        $row = DB::table('record_broadcast_metadata')->where('item_id', $recordId)->first();

        return response()->json([
            'ok' => true,
            'configured' => true,
            'integrations' => $this->broadcast->integrations(),
            'metadata' => $row ? $this->formatRow($row) : null,
        ]);
    }

    public function update(Request $request, string $recordId): JsonResponse
    {
        if (! $this->recordExists($recordId)) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        if (! $this->broadcast->isConfigured()) {
            return response()->json([
                'ok' => false,
                'error' => 'Broadcast integration is not configured.',
                'code' => 'config_required',
            ], 409);
        }

        $validated = $request->validate([
            'mosObjectId' => ['nullable', 'string', 'max:255'],
            'mosProgramId' => ['nullable', 'string', 'max:255'],
            'mxfUmid' => ['nullable', 'string', 'max:255'],
            'mxfFormat' => ['nullable', 'string', 'max:255'],
            'raw' => ['nullable', 'array'],
        ]);

        $now = now();
        $exists = DB::table('record_broadcast_metadata')->where('item_id', $recordId)->exists();

        $values = [
            'mos_object_id' => $validated['mosObjectId'] ?? null,
            'mos_program_id' => $validated['mosProgramId'] ?? null,
            'mxf_umid' => $validated['mxfUmid'] ?? null,
            'mxf_format' => $validated['mxfFormat'] ?? null,
            'raw' => isset($validated['raw']) ? json_encode($validated['raw'], JSON_THROW_ON_ERROR) : null,
            'updated_at' => $now,
        ];

        if (! $exists) {
            $values['created_at'] = $now;
        }

        DB::table('record_broadcast_metadata')->updateOrInsert(['item_id' => $recordId], $values);

        $row = DB::table('record_broadcast_metadata')->where('item_id', $recordId)->first();

        return response()->json([
            'ok' => true,
            'configured' => true,
            'integrations' => $this->broadcast->integrations(),
            'metadata' => $this->formatRow($row),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRow(stdClass $row): array
    {
        return [
            'itemId' => $row->item_id,
            'mosObjectId' => $row->mos_object_id,
            'mosProgramId' => $row->mos_program_id,
            'mxfUmid' => $row->mxf_umid,
            'mxfFormat' => $row->mxf_format,
            'raw' => $row->raw ? json_decode((string) $row->raw, true) : null,
            'updatedAt' => $row->updated_at,
        ];
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
}
