<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use stdClass;

// V1-868: which source (manual entry, template, CSV import, or bulk
// operation) last set each metadata field — recorded opt-in from
// RecordsController::bulk's fieldSources payload.
class RecordFieldSourcesController extends Controller
{
    public function index(string $recordId): JsonResponse
    {
        $sources = DB::table('record_field_sources')
            ->where('record_id', $recordId)
            ->orderBy('field')
            ->get()
            ->map(fn (stdClass $row): array => [
                'field' => $row->field,
                'source' => $row->source,
                'updatedAt' => $row->updated_at,
            ])
            ->values();

        return response()->json(['ok' => true, 'sources' => $sources]);
    }
}
