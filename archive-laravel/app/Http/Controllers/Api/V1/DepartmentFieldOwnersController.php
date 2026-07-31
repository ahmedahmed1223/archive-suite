<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class DepartmentFieldOwnersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(['departmentId' => ['required', 'string', 'max:100']]);
        $owners = DB::table('department_field_owners')->where('department_id', $validated['departmentId'])->orderBy('field')->get()->map(fn (object $row): array => $this->format($row))->values();

        return response()->json(['ok' => true, 'owners' => $owners]);
    }

    public function replace(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $validated = $request->validate([
            'departmentId' => ['required', 'string', 'max:100'],
            'owners' => ['present', 'array', 'max:100'],
            'owners.*.field' => ['required', 'string', 'max:100', 'distinct'],
            'owners.*.owner' => ['required', 'string', 'max:200'],
        ]);

        DB::transaction(function () use ($validated): void {
            DB::table('department_field_owners')->where('department_id', $validated['departmentId'])->delete();
            $now = now();
            $rows = array_map(fn (array $owner): array => ['id' => (string) Str::uuid(), 'department_id' => $validated['departmentId'], 'field' => $owner['field'], 'owner' => $owner['owner'], 'created_at' => $now, 'updated_at' => $now], $validated['owners']);
            if ($rows !== []) DB::table('department_field_owners')->insert($rows);
        });

        return $this->index($request);
    }

    /** @return array{id: string, departmentId: string, field: string, owner: string} */
    private function format(object $row): array { return ['id' => $row->id, 'departmentId' => $row->department_id, 'field' => $row->field, 'owner' => $row->owner]; }
}
