<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\SelfApprovalException;
use App\Http\Controllers\Controller;
use App\Models\ApprovalRequest;
use App\Models\BulkMacro;
use App\Models\User;
use App\Services\Approvals\ApprovalRequestService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * V3-WORK-003: submit, decide on, and execute dual-approval requests for
 * sensitive bulk-macro operations. Every non-GET action here runs inside
 * the archive.auth + archive.audit route group, so every decision and
 * every execution is audit-logged automatically (see
 * App\Http\Middleware\AuditArchiveApiRequest::classify()).
 */
class ApprovalRequestsController extends Controller
{
    public function __construct(private readonly ApprovalRequestService $service) {}

    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $requests = ApprovalRequest::query()->with('decisions')->latest()->get()
            ->map(fn (ApprovalRequest $approvalRequest): array => $this->format($approvalRequest))
            ->values();

        return response()->json(['ok' => true, 'requests' => $requests]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $approvalRequest = ApprovalRequest::query()->with('decisions')->find($id);
        if (! $approvalRequest instanceof ApprovalRequest) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'request' => $this->format($approvalRequest)]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'targetType' => ['required', 'string', Rule::in([ApprovalRequestService::TARGET_TYPE_BULK_MACRO])],
            'targetId' => ['required', 'string'],
            'targets' => ['required', 'array', 'min:1', 'max:1000'],
            'targets.*' => ['required', 'array'],
            'targets.*.store' => ['required', 'string', 'max:100'],
            'targets.*.id' => ['required', 'string', 'max:255'],
        ]);

        $macro = BulkMacro::query()->find($validated['targetId']);
        if (! $macro instanceof BulkMacro) {
            return $this->notFound();
        }

        try {
            $approvalRequest = $this->service->submit($this->user($request), $macro, $validated['targets']);
        } catch (RuntimeException) {
            return response()->json(['ok' => false, 'error' => 'This macro has no sensitive step under the current policy; it does not require approval.', 'code' => 'operation_not_sensitive'], 422);
        }

        return response()->json(['ok' => true, 'request' => $this->format($approvalRequest)], 201);
    }

    public function decide(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $approvalRequest = ApprovalRequest::query()->find($id);
        if (! $approvalRequest instanceof ApprovalRequest) {
            return $this->notFound();
        }

        $validated = $request->validate([
            'decision' => ['required', 'string', Rule::in(['approve', 'reject'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $approvalRequest = $this->service->decide($approvalRequest, $this->user($request), $validated['decision'], $validated['notes'] ?? null);
        } catch (SelfApprovalException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 403, 'self_approval'), 403);
        } catch (RuntimeException $exception) {
            return response()->json(['ok' => false, 'error' => $exception->getMessage(), 'code' => $exception->getMessage()], 409);
        }

        return response()->json(['ok' => true, 'request' => $this->format($approvalRequest->fresh('decisions'))]);
    }

    public function execute(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $approvalRequest = ApprovalRequest::query()->find($id);
        if (! $approvalRequest instanceof ApprovalRequest) {
            return $this->notFound();
        }

        try {
            $run = $this->service->execute($approvalRequest, $this->user($request));
        } catch (RuntimeException $exception) {
            return response()->json(['ok' => false, 'error' => $exception->getMessage(), 'code' => $exception->getMessage()], 409);
        }

        return response()->json([
            'ok' => true,
            'request' => $this->format($approvalRequest->fresh('decisions')),
            'run' => [
                'id' => $run->id,
                'macroId' => $run->macro_id,
                'targetCount' => $run->target_count,
                'completedCount' => $run->completed_count,
                'failedCount' => $run->failed_count,
                'results' => $run->results,
            ],
        ], 201);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->attributes->get('archive_user');

        return $user;
    }

    /** @return array<string, mixed> */
    private function format(ApprovalRequest $approvalRequest): array
    {
        return [
            'id' => $approvalRequest->id,
            'operationKey' => $approvalRequest->operation_key,
            'targetType' => $approvalRequest->target_type,
            'targetId' => $approvalRequest->target_id,
            'requestedBy' => $approvalRequest->requested_by,
            'status' => $approvalRequest->status,
            'requiredApprovals' => $approvalRequest->required_approvals,
            'payload' => $approvalRequest->payload,
            'executedRunId' => $approvalRequest->executed_run_id,
            'executedAt' => $approvalRequest->executed_at?->toIso8601String(),
            'decisions' => $approvalRequest->relationLoaded('decisions')
                ? $approvalRequest->decisions->map(fn ($decision): array => [
                    'id' => $decision->id,
                    'approverId' => $decision->approver_id,
                    'decision' => $decision->decision,
                    'notes' => $decision->notes,
                    'decidedAt' => $decision->created_at?->toIso8601String(),
                ])->values()->all()
                : [],
            'createdAt' => $approvalRequest->created_at?->toIso8601String(),
            'updatedAt' => $approvalRequest->updated_at?->toIso8601String(),
        ];
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Approval request not found.', 'code' => 'not_found'], 404);
    }
}
