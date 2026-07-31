<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DepartmentQualityRulesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['ok' => true, 'rules' => DB::table('department_quality_rules')->when($request->filled('departmentId'), fn ($q) => $q->where('department_id', $request->string('departmentId')->toString()))->orderBy('department_id')->get()->map(fn ($r) => $this->format($r))->values()]);
    }

    public function upsert(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $v = $request->validate(['departmentId' => ['required', 'string', 'max:100'], 'typeId' => ['nullable', 'string', 'max:100'], 'requiredFields' => ['required', 'array'], 'requiredFields.*' => ['string', 'max:100'], 'enabled' => ['sometimes', 'boolean']]);
        $existing = DB::table('department_quality_rules')->where('department_id', $v['departmentId'])->where('type_id', $v['typeId'] ?? null)->first();
        $values = ['required_fields' => json_encode(array_values(array_unique($v['requiredFields']))), 'enabled' => $v['enabled'] ?? true, 'updated_at' => now()];
        if ($existing) DB::table('department_quality_rules')->where('id', $existing->id)->update($values); else { $values += ['id' => (string) Str::uuid(), 'department_id' => $v['departmentId'], 'type_id' => $v['typeId'] ?? null, 'created_at' => now()]; DB::table('department_quality_rules')->insert($values); }
        $rule = DB::table('department_quality_rules')->where('department_id', $v['departmentId'])->where('type_id', $v['typeId'] ?? null)->first();
        return response()->json(['ok' => true, 'rule' => $this->format($rule)], $existing ? 200 : 201);
    }

    public function preview(Request $request): JsonResponse
    {
        $v = $request->validate(['departmentId' => ['required', 'string'], 'typeId' => ['nullable', 'string'], 'metadata' => ['sometimes', 'array'], 'tags' => ['sometimes', 'array']]);
        $rule = DB::table('department_quality_rules')->where('department_id', $v['departmentId'])->where('enabled', true)->where(fn ($q) => $q->where('type_id', $v['typeId'] ?? null)->orWhereNull('type_id'))->orderByRaw('type_id is null')->first();
        $fields = $rule ? json_decode($rule->required_fields, true) : [];
        $metadata = $v['metadata'] ?? []; $missing = array_values(array_filter($fields, fn ($field) => !array_key_exists($field, $metadata) || $metadata[$field] === null || $metadata[$field] === ''));
        return response()->json(['ok' => true, 'ready' => $missing === [], 'missingFields' => $missing, 'ruleId' => $rule?->id]);
    }

    private function format(object $r): array { return ['id' => $r->id, 'departmentId' => $r->department_id, 'typeId' => $r->type_id, 'requiredFields' => json_decode($r->required_fields, true), 'enabled' => (bool) $r->enabled]; }
}
