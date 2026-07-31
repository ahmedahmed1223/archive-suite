<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class DepartmentTemplateMetricsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(['departmentId' => ['required', 'string', 'max:100']]);
        $departmentId = $validated['departmentId'];
        $templates = DB::table('metadata_templates')->where('department_id', $departmentId)->get();
        $rules = DB::table('department_quality_rules')->where('department_id', $departmentId)->where('enabled', true)->get();
        $required = collect($rules)->flatMap(fn (object $rule) => json_decode($rule->required_fields, true) ?: [])->unique()->values();
        $recordRows = DB::table('storage_rows')->where('store', 'archive-items')->get(['data']);
        $records = $recordRows->map(fn (object $row) => json_decode($row->data, true) ?: [])->filter(fn (array $record) => ($record['departmentId'] ?? null) === $departmentId)->values();
        $missing = $required->mapWithKeys(fn (string $field) => [$field => $records->filter(fn (array $record) => empty($record[$field]) && empty(($record['metadata'] ?? [])[$field]))->count()]);

        return response()->json(['ok' => true, 'metrics' => [
            'departmentId' => $departmentId,
            'templateCount' => $templates->count(),
            'publishedTemplateCount' => $templates->filter(fn (object $template) => $template->published_version !== null)->count(),
            'qualityRuleCount' => $rules->count(),
            'recordCount' => $records->count(),
            'missingFieldCounts' => $missing,
        ]]);
    }
}
