<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

// V1-858: optional per-project/per-type filename prefix rules — detection + suggestion
// only, callers never rename storage from these directly.
class NamingRulesController extends Controller
{
    public function index(): JsonResponse
    {
        $rules = DB::table('naming_rules')
            ->orderBy('key')
            ->get()
            ->map(fn (stdClass $rule): array => $this->formatRule($rule))
            ->values();

        return response()->json(['ok' => true, 'rules' => $rules]);
    }

    public function upsert(Request $request, string $key): JsonResponse
    {
        $validated = $request->validate([
            'prefix' => ['required', 'string', 'max:100'],
        ]);

        $now = now();
        DB::table('naming_rules')->updateOrInsert(
            ['key' => $key],
            ['prefix' => $validated['prefix'], 'updated_at' => $now, 'created_at' => $now]
        );

        $rule = DB::table('naming_rules')->where('key', $key)->first();

        return response()->json(['ok' => true, 'rule' => $this->formatRule($rule)]);
    }

    public function destroy(string $key): JsonResponse
    {
        $deleted = DB::table('naming_rules')->where('key', $key)->delete();

        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Naming rule not found.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRule(stdClass $rule): array
    {
        return [
            'key' => $rule->key,
            'prefix' => $rule->prefix,
            'updatedAt' => $rule->updated_at,
        ];
    }
}
