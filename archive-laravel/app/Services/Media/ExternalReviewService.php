<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Models\AuditLog;
use App\Models\MediaDerivative;
use App\Models\ReviewLink;
use App\Models\ReviewLinkDecision;
use App\Models\ReviewSession;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * V3-MEDIA-007: external (public, token-gated) media review -- the layer
 * ReviewLinksController delegates to for everything beyond the original
 * view/comment-only link (V3-MEDIA-001-era). Reuses, rather than
 * reimplements:
 *  - ReviewSessionService for record existence + the checksum-derived
 *    version_token (V3-MEDIA-002) and its approve/request_changes state
 *    machine, which backs the "what was decided" half of the review report;
 *  - MediaDerivativeService/MediaDerivative for "serve a lightweight
 *    derivative instead of the original" (V3-MEDIA-006) -- this class never
 *    generates a derivative, only prefers an already-ready one.
 *
 * Default duration: a link created without an explicit expiresAt/
 * durationHours is deliberately never open-ended -- it gets
 * DEFAULT_DURATION_HOURS so "time-bounded" holds unconditionally (spec
 * acceptance), not just when the caller remembers to set an expiry.
 *
 * Watermarking: watermark_policy is stored/validated/reported and reflected
 * on the media response via the X-Review-Watermark-Policy header (consumed
 * by the Next.js viewer to render a visible on-screen overlay). Burning a
 * watermark into the actual pixel/frame data is deliberately NOT
 * implemented here -- this codebase has no image/video manipulation
 * dependency today (no GD usage, no intervention/image, and video burn-in
 * already has a real hook in RealMediaProcessor's ffmpeg overlay filter,
 * but wiring that into the derivative pipeline is V3-MEDIA-006 territory,
 * outside this task's exclusive lock). See ReviewLinksController::media().
 */
final class ExternalReviewService
{
    private const DEFAULT_DURATION_HOURS = 168.0; // 7 days

    public function __construct(
        private readonly ReviewSessionService $sessions,
        private readonly MediaDerivativeService $derivatives,
        private readonly MediaPathGuard $pathGuard,
    ) {}

    /**
     * @param  array<string, mixed>  $options
     */
    public function createLink(string $mediaUid, array $options, ?User $actor): ReviewLink
    {
        $recordStore = null;
        $versionToken = null;
        $reviewSessionId = null;
        $attachmentId = $options['attachmentId'] ?? null;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->sessions->assertRecordExists($mediaUid, $options['store'] ?? null);
            $versionToken = $this->sessions->resolveVersionToken($recordStore, $recordUid, $attachmentId);

            $session = $this->sessions->create($recordUid, $recordStore, $attachmentId, null, $actor);
            $session = $this->sessions->transition($session, 'start', $actor, null);
            $reviewSessionId = $session->id;
        } catch (RuntimeException) {
            // Soft-degrade: mediaUid does not resolve to a real storage_rows
            // record (legacy opaque-uid callers, or comment-only usage that
            // predates V3-MEDIA-007). Version pinning, derivative-preference,
            // and decision tracking simply stay unavailable for this link --
            // see the ReviewLinksApiTest baseline this keeps passing.
            $recordStore = null;
        }

        $derivativeId = $this->assertDerivativeBelongsToMedia($options['derivativeId'] ?? null, $mediaUid);

        return ReviewLink::query()->create([
            'token' => Str::random(64),
            'media_uid' => $mediaUid,
            'permission' => $options['permission'] ?? 'view',
            'expires_at' => $this->resolveExpiry($options),
            'record_store' => $recordStore,
            'attachment_id' => $attachmentId,
            'version_token' => $versionToken,
            'source_path' => $options['sourcePath'] ?? null,
            'derivative_id' => $derivativeId,
            'review_session_id' => $reviewSessionId,
            'allow_download' => (bool) ($options['allowDownload'] ?? false),
            'watermark_policy' => $options['watermarkPolicy'] ?? ReviewLink::WATERMARK_NONE,
            'required_approvals' => (int) ($options['requiredApprovals'] ?? 1),
        ]);
    }

    /**
     * Resolves the actual bytes to stream for this link: a ready, still-current
     * derivative when one is attached (the "lightweight derivative instead of
     * the original" acceptance criterion), otherwise the link's own
     * server-validated source_path. Never returns a path that isn't already
     * safely contained under the media storage root, and never exposes the
     * disk/path to the caller -- ReviewLinksController::media() streams the
     * bytes directly, the response body is all the client ever sees.
     *
     * @return array{absolutePath: string, kind: string}|null
     */
    public function resolveMediaSource(ReviewLink $link): ?array
    {
        if ($link->derivative_id !== null) {
            $derivative = MediaDerivative::query()->find($link->derivative_id);

            if (
                $derivative instanceof MediaDerivative
                && $derivative->status === 'ready'
                && is_string($derivative->storage_key)
                && $this->derivatives->isCurrentVersion($derivative)
            ) {
                $path = $this->safeExistingPath($derivative->storage_key);
                if ($path !== null) {
                    return ['absolutePath' => $path, 'kind' => 'derivative:'.$derivative->derivative_type];
                }
            }
        }

        if (is_string($link->source_path)) {
            $path = $this->safeExistingPath($link->source_path);
            if ($path !== null) {
                return ['absolutePath' => $path, 'kind' => 'source'];
            }
        }

        return null;
    }

    /**
     * Records one reviewer's decision, then -- only when it actually changes
     * the outcome -- advances the backing review_sessions row through its
     * existing state machine (ReviewSessionService::transition). A single
     * request_changes always halts approval regardless of required_approvals;
     * an approve only finalizes once at least required_approvals *distinct*
     * reviewer names have each most-recently voted approve. Self-approval
     * (the same person casting both of a dual-approval's votes) is
     * deliberately not blocked here -- that policy belongs to V3-WORK-003.
     *
     * @return array{decision: ReviewLinkDecision, session: ?ReviewSession, approvalsReceived: int}
     *
     * @throws RuntimeException if the link has already expired (fail closed).
     */
    public function recordDecision(
        ReviewLink $link,
        string $reviewerName,
        ?string $reviewerEmail,
        string $decision,
        ?string $notes,
        ?string $ip,
        ?string $userAgent,
    ): array {
        if ($link->isExpired()) {
            throw new RuntimeException('Review link has expired.');
        }

        $row = ReviewLinkDecision::query()->create([
            'id' => (string) Str::uuid(),
            'review_link_token' => $link->token,
            'reviewer_name' => $reviewerName,
            'reviewer_email' => $reviewerEmail,
            'decision' => $decision,
            'notes' => $notes,
            'ip_address' => $ip,
        ]);

        $session = $link->review_session_id !== null ? ReviewSession::query()->find($link->review_session_id) : null;
        $approvalsReceived = $this->latestApprovalCount($link);

        if ($session instanceof ReviewSession && $session->state === ReviewSession::STATE_IN_REVIEW) {
            if ($decision === ReviewLinkDecision::DECISION_REQUEST_CHANGES) {
                $session = $this->sessions->transition($session, 'request_changes', null, $notes);
            } elseif ($decision === ReviewLinkDecision::DECISION_APPROVE && $approvalsReceived >= $link->required_approvals) {
                $session = $this->sessions->transition($session, 'approve', null, $notes);
            }
        }

        $this->writeAuditLog($link, $row, $session, $userAgent);

        return ['decision' => $row, 'session' => $session, 'approvalsReceived' => $approvalsReceived];
    }

    /**
     * The audit-proof report: which version was reviewed, who the reviewers
     * were, and what the decision was -- backed by review_link_decisions
     * (full history, immutable) plus the hash-chained audit_logs rows
     * writeAuditLog() creates alongside every decision (AuditLog::booted()
     * chains prev_hash/hash, see AuditVerifyChainCommand for independent
     * tamper verification of that chain).
     *
     * @return array<string, mixed>
     */
    public function buildReport(ReviewLink $link): array
    {
        $session = $link->review_session_id !== null ? ReviewSession::query()->find($link->review_session_id) : null;
        $decisions = ReviewLinkDecision::query()
            ->where('review_link_token', $link->token)
            ->orderBy('created_at')
            ->get();

        return [
            'token' => $link->token,
            'mediaUid' => $link->media_uid,
            'recordStore' => $link->record_store,
            'attachmentId' => $link->attachment_id,
            'versionToken' => $link->version_token,
            'isCurrentVersion' => $this->isCurrentVersion($link),
            'expiresAt' => $link->expires_at?->toISOString(),
            'isExpired' => $link->isExpired(),
            'allowDownload' => $link->allow_download,
            'watermarkPolicy' => $link->watermark_policy,
            'requiredApprovals' => $link->required_approvals,
            'session' => $session instanceof ReviewSession ? [
                'id' => $session->id,
                'state' => $session->state,
                'decidedBy' => $session->decided_by,
                'decidedAt' => $session->decided_at?->toISOString(),
            ] : null,
            'reviewers' => $decisions->map(fn (ReviewLinkDecision $decision): array => [
                'id' => $decision->id,
                'reviewerName' => $decision->reviewer_name,
                'reviewerEmail' => $decision->reviewer_email,
                'decision' => $decision->decision,
                'notes' => $decision->notes,
                'decidedAt' => $decision->created_at?->toISOString(),
            ])->values()->all(),
            'approvals' => [
                'required' => $link->required_approvals,
                'received' => $this->latestApprovalCount($link),
            ],
        ];
    }

    public function isCurrentVersion(ReviewLink $link): ?bool
    {
        if ($link->record_store === null || $link->version_token === null) {
            return null;
        }

        try {
            return $this->sessions->resolveVersionToken($link->record_store, $link->media_uid, $link->attachment_id) === $link->version_token;
        } catch (RuntimeException) {
            return false;
        }
    }

    /**
     * Count of distinct reviewers whose most recent decision on this link is
     * 'approve'. Ties within the same second across reviewers are resolved
     * by insertion order (id), which is good enough for this: two distinct
     * reviewers racing to the same second is a vanishingly rare edge case,
     * not a security boundary.
     */
    private function latestApprovalCount(ReviewLink $link): int
    {
        return ReviewLinkDecision::query()
            ->where('review_link_token', $link->token)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->unique('reviewer_name')
            ->where('decision', ReviewLinkDecision::DECISION_APPROVE)
            ->count();
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private function resolveExpiry(array $options): Carbon
    {
        $durationHours = $options['durationHours'] ?? null;
        if (is_numeric($durationHours) && (float) $durationHours > 0) {
            return now()->addMinutes((int) round((float) $durationHours * 60));
        }

        $expiresAt = $options['expiresAt'] ?? null;
        if (is_string($expiresAt) && $expiresAt !== '') {
            return Carbon::parse($expiresAt);
        }

        return now()->addHours(self::DEFAULT_DURATION_HOURS);
    }

    private function assertDerivativeBelongsToMedia(?string $derivativeId, string $mediaUid): ?string
    {
        if ($derivativeId === null) {
            return null;
        }

        $derivative = MediaDerivative::query()->find($derivativeId);
        if (! $derivative instanceof MediaDerivative || $derivative->record_uid !== $mediaUid) {
            throw new RuntimeException('Derivative does not belong to this media.');
        }

        return $derivativeId;
    }

    private function safeExistingPath(string $relativeKey): ?string
    {
        try {
            $path = $this->pathGuard->resolveInput($relativeKey, 'review link media path');
        } catch (RuntimeException) {
            return null;
        }

        return is_file($path) ? $path : null;
    }

    private function writeAuditLog(ReviewLink $link, ReviewLinkDecision $decision, ?ReviewSession $session, ?string $userAgent): void
    {
        // Deliberately not routed through the archive.audit middleware /
        // AuditArchiveApiRequest: that middleware logs $request->path()
        // verbatim into the 'action' field, which for this route would
        // persist the review link's bearer token in plaintext into a
        // permanent (hash-chained, never-deleted) audit trail. Writing the
        // AuditLog row directly here keeps the same model/hash-chain
        // guarantee (AuditLog::booted()) without that leak.
        AuditLog::query()->create([
            'action' => 'POST /api/v1/review-links/decisions',
            'event' => 'review_links.decide',
            'resource_type' => 'review_link_decision',
            'resource_id' => $decision->id,
            'actor_id' => null,
            'outcome' => 'success',
            'status_code' => 201,
            'metadata' => [
                'reviewSessionId' => $session?->id,
                'recordStore' => $link->record_store,
                'mediaUid' => $link->media_uid,
                'versionToken' => $link->version_token,
                'reviewerName' => $decision->reviewer_name,
                'decision' => $decision->decision,
                'sessionState' => $session?->state,
            ],
            'ip_address' => $decision->ip_address,
            'user_agent' => $userAgent,
        ]);
    }
}
