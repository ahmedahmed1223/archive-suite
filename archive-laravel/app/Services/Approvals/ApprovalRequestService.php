<?php

declare(strict_types=1);

namespace App\Services\Approvals;

use App\Models\ApprovalDecision;
use App\Models\ApprovalRequest;
use App\Models\BulkMacro;
use App\Models\BulkMacroRun;
use App\Models\SensitiveOperationPolicy;
use App\Models\User;
use App\Services\BulkMacros\BulkMacroService;
use App\Support\SelfApprovalGuard;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * V3-WORK-003: dual approval for sensitive bulk-macro operations. A macro
 * run is "sensitive" when at least one of its step types is flagged
 * sensitive in sensitive_operation_policies (admin-configurable, default
 * off so existing bulk-macro behavior is unchanged until an admin opts a
 * step type in). Execution always delegates to BulkMacroService::execute()
 * -- this class never mutates archive data itself, only gates access to it.
 *
 * The requester is never permitted to record any decision on their own
 * request (see decide() -> SelfApprovalGuard), not merely excluded from
 * being counted as the deciding vote -- a stronger, simpler guarantee than
 * "cannot be the second approver" that still satisfies it.
 */
final class ApprovalRequestService
{
    public const TARGET_TYPE_BULK_MACRO = 'bulk-macro';

    public function __construct(private readonly BulkMacroService $macros) {}

    /** @return array<int, string> */
    public function sensitiveStepTypes(): array
    {
        return SensitiveOperationPolicy::query()->where('sensitive', true)->pluck('operation_key')->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $targets
     *
     * @throws RuntimeException when no step in the macro is currently flagged
     *                           sensitive (nothing to approve).
     */
    public function submit(User $requester, BulkMacro $macro, array $targets): ApprovalRequest
    {
        $normalizedTargets = $this->macros->normalizeTargets($targets);
        $stepTypes = array_values(array_unique(array_filter(array_map(
            fn (mixed $step): ?string => is_array($step) ? ($step['type'] ?? null) : null,
            (array) $macro->steps,
        ))));
        $sensitiveSteps = array_values(array_intersect($stepTypes, $this->sensitiveStepTypes()));

        if ($sensitiveSteps === []) {
            throw new RuntimeException('operation_not_sensitive');
        }

        $requiredApprovals = max(2, (int) SensitiveOperationPolicy::query()
            ->whereIn('operation_key', $sensitiveSteps)
            ->max('required_approvals'));

        return ApprovalRequest::query()->create([
            'id' => (string) Str::uuid(),
            'operation_key' => 'bulk-macro-run',
            'target_type' => self::TARGET_TYPE_BULK_MACRO,
            'target_id' => $macro->id,
            'requested_by' => $requester->id,
            'status' => ApprovalRequest::STATUS_PENDING,
            'required_approvals' => $requiredApprovals,
            'payload' => ['targets' => $normalizedTargets, 'macroVersion' => $macro->version, 'sensitiveSteps' => $sensitiveSteps],
        ]);
    }

    /**
     * @throws RuntimeException with message 'not_pending' or 'already_decided'.
     */
    public function decide(ApprovalRequest $request, User $approver, string $decision, ?string $notes): ApprovalRequest
    {
        if ($request->status !== ApprovalRequest::STATUS_PENDING) {
            throw new RuntimeException('not_pending');
        }

        // Structural, not just "don't count this vote": the requester is
        // refused a decision row entirely. See class docblock.
        SelfApprovalGuard::assertNotSelfApproving($request->requested_by, $approver->getKey());

        $alreadyDecided = ApprovalDecision::query()
            ->where('approval_request_id', $request->id)
            ->where('approver_id', $approver->id)
            ->exists();
        if ($alreadyDecided) {
            throw new RuntimeException('already_decided');
        }

        ApprovalDecision::query()->create([
            'id' => (string) Str::uuid(),
            'approval_request_id' => $request->id,
            'approver_id' => $approver->id,
            'decision' => $decision,
            'notes' => $notes,
        ]);

        if ($decision === ApprovalDecision::DECISION_REJECT) {
            // A single rejection always halts the request, mirroring
            // ExternalReviewService's request_changes semantics.
            $request->status = ApprovalRequest::STATUS_REJECTED;
            $request->save();

            return $request;
        }

        $approvals = ApprovalDecision::query()
            ->where('approval_request_id', $request->id)
            ->where('decision', ApprovalDecision::DECISION_APPROVE)
            ->count();

        if ($approvals >= $request->required_approvals) {
            $request->status = ApprovalRequest::STATUS_APPROVED;
            $request->save();
        }

        return $request;
    }

    /**
     * @throws RuntimeException with message 'not_approved', 'unsupported_target',
     *                          'macro_not_found', or 'stale_approval'.
     */
    public function execute(ApprovalRequest $request, User $actor): BulkMacroRun
    {
        if ($request->status !== ApprovalRequest::STATUS_APPROVED) {
            throw new RuntimeException('not_approved');
        }
        if ($request->target_type !== self::TARGET_TYPE_BULK_MACRO) {
            throw new RuntimeException('unsupported_target');
        }

        $macro = BulkMacro::query()->find($request->target_id);
        if (! $macro instanceof BulkMacro) {
            throw new RuntimeException('macro_not_found');
        }
        if ($macro->version !== (int) ($request->payload['macroVersion'] ?? null)) {
            // The macro changed after this approval was granted; the
            // approval no longer covers what would actually run.
            throw new RuntimeException('stale_approval');
        }

        /** @var array<int, array{store: string, id: string}> $targets */
        $targets = $request->payload['targets'] ?? [];
        $run = $this->macros->execute($macro, $actor, $targets);

        $request->status = ApprovalRequest::STATUS_EXECUTED;
        $request->executed_run_id = $run->id;
        $request->executed_at = now();
        $request->save();

        return $run;
    }
}
