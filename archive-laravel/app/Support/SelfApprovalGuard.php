<?php

declare(strict_types=1);

namespace App\Support;

use App\Exceptions\SelfApprovalException;

/**
 * V3-WORK-003: the one general, reusable self-approval check every
 * dual-approval flow in this codebase routes through, so the rule lives in
 * exactly one place instead of being re-derived per call site. A submitter
 * must never also count as an approver of their own request.
 *
 * Used by:
 *  - App\Services\Approvals\ApprovalRequestService::decide() -- this task's
 *    own sensitive-bulk-macro approval flow.
 *  - App\Services\Media\ReviewSessionService::transition() -- V3-MEDIA-002's
 *    review-session approve action, which deferred this exact policy here
 *    (see that method's docblock). An authenticated editor could previously
 *    open a review session and then approve their own submission.
 *
 * Not wired into App\Services\Media\ExternalReviewService: external review
 * links are decided by unauthenticated reviewers identified only by
 * free-text name/email (no App\Models\User id is ever recorded for them),
 * so there is no internal identity to compare the submitter against. See
 * that class's recordDecision() docblock for the existing acknowledgement
 * of this boundary.
 */
final class SelfApprovalGuard
{
    /**
     * @throws SelfApprovalException when both ids are present and equal.
     */
    public static function assertNotSelfApproving(int|string|null $submitterId, int|string|null $approverId): void
    {
        if ($submitterId === null || $approverId === null) {
            return;
        }

        if ((string) $submitterId === (string) $approverId) {
            throw new SelfApprovalException('A submitter cannot approve or decide their own request.');
        }
    }
}
