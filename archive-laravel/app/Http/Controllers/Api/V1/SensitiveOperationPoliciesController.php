<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SensitiveOperationPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * V3-WORK-003: which bulk-macro step types require dual approval before
 * they may run. Read is open to any authenticated user (they need to know
 * before submitting a macro whether it will require approval); updating is
 * admin-only -- same read/write boundary as TaskEscalationPolicyController.
 */
class SensitiveOperationPoliciesController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'policies' => SensitiveOperationPolicy::query()->orderBy('operation_key')->get()->map(fn (SensitiveOperationPolicy $policy): array => $this->format($policy))->values(),
        ]);
    }

    public function update(Request $request, string $operationKey): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $policy = SensitiveOperationPolicy::query()->find($operationKey);
        if (! $policy instanceof SensitiveOperationPolicy) {
            return response()->json(['ok' => false, 'error' => 'Unknown operation.', 'code' => 'not_found'], 404);
        }

        $validated = $request->validate([
            'sensitive' => ['sometimes', 'boolean'],
            'requiredApprovals' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);
        if ($validated === []) {
            return response()->json(['ok' => false, 'error' => 'No policy fields supplied.', 'code' => 'validation_error'], 422);
        }

        if (array_key_exists('sensitive', $validated)) {
            $policy->sensitive = $validated['sensitive'];
        }
        if (array_key_exists('requiredApprovals', $validated)) {
            $policy->required_approvals = $validated['requiredApprovals'];
        }
        $policy->save();

        return response()->json(['ok' => true, 'policy' => $this->format($policy)]);
    }

    /** @return array<string, mixed> */
    private function format(SensitiveOperationPolicy $policy): array
    {
        return [
            'operationKey' => $policy->operation_key,
            'sensitive' => $policy->sensitive,
            'requiredApprovals' => $policy->required_approvals,
            'updatedAt' => $policy->updated_at?->toIso8601String(),
        ];
    }
}
