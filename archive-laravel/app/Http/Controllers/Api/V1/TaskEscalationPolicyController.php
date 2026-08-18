<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * V3-WORK-002: admin-configurable thresholds for
 * App\Console\Commands\CheckTaskEscalationsCommand. Single row keyed by
 * id='default' (see task_escalation_policies migration) - read is open to
 * any authenticated user (same boundary as CapabilitiesController::index),
 * updating it is admin-only (same boundary as CapabilitiesController::update).
 */
class TaskEscalationPolicyController extends Controller
{
    private const ID = 'default';

    public function show(): JsonResponse
    {
        return response()->json(['ok' => true, 'policy' => $this->format($this->row())]);
    }

    public function update(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'warningBeforeMinutes' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'repeatMinutes' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ]);

        if ($validated === []) {
            return response()->json(['ok' => false, 'error' => 'No policy fields supplied.', 'code' => 'validation_error'], 422);
        }

        $map = ['warningBeforeMinutes' => 'warning_before_minutes', 'repeatMinutes' => 'repeat_minutes'];
        $updates = ['updated_at' => now()];
        foreach ($validated as $field => $value) {
            $updates[$map[$field] ?? $field] = $value;
        }

        DB::table('task_escalation_policies')->where('id', self::ID)->update($updates);

        return response()->json(['ok' => true, 'policy' => $this->format($this->row())]);
    }

    private function row(): stdClass
    {
        /** @var stdClass $row */
        $row = DB::table('task_escalation_policies')->where('id', self::ID)->first();

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function format(stdClass $row): array
    {
        return [
            'enabled' => (bool) $row->enabled,
            'warningBeforeMinutes' => $row->warning_before_minutes !== null ? (int) $row->warning_before_minutes : null,
            'repeatMinutes' => $row->repeat_minutes !== null ? (int) $row->repeat_minutes : null,
            'updatedAt' => $row->updated_at,
        ];
    }
}
