<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Exceptions\InvalidReviewTransitionException;
use App\Models\ReviewSession;
use App\Models\User;
use App\Support\SelfApprovalGuard;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use stdClass;

/**
 * Owns the review-session state machine (V3-MEDIA-002). A session is opened
 * against a record + optional attachment at a specific version, and the
 * version it was opened against is pinned forever in version_token -- see
 * the migration for why that is what keeps an approval from silently
 * covering a replaced source file.
 */
final class ReviewSessionService
{
    private const ARCHIVE_STORE = 'archive-items';

    /**
     * @var array<string, array{from: array<int, string>, to: string}>
     */
    private const TRANSITIONS = [
        'start' => ['from' => [ReviewSession::STATE_DRAFT], 'to' => ReviewSession::STATE_IN_REVIEW],
        'request_changes' => ['from' => [ReviewSession::STATE_IN_REVIEW], 'to' => ReviewSession::STATE_CHANGES_REQUESTED],
        'approve' => ['from' => [ReviewSession::STATE_IN_REVIEW], 'to' => ReviewSession::STATE_APPROVED],
        'resume' => ['from' => [ReviewSession::STATE_CHANGES_REQUESTED], 'to' => ReviewSession::STATE_IN_REVIEW],
        'close' => [
            'from' => [
                ReviewSession::STATE_DRAFT,
                ReviewSession::STATE_IN_REVIEW,
                ReviewSession::STATE_CHANGES_REQUESTED,
                ReviewSession::STATE_APPROVED,
            ],
            'to' => ReviewSession::STATE_CLOSED,
        ],
    ];

    /**
     * Decisions worth remembering "who made the call" for, beyond the
     * generic updated_at trail. Self-approval on 'approve' is blocked via
     * SelfApprovalGuard below (V3-WORK-003); 'request_changes' is left
     * unguarded since asking for changes on your own submission is not the
     * risk this policy targets.
     */
    private const DECISION_ACTIONS = ['approve', 'request_changes'];

    /**
     * @return array{recordStore: string, recordUid: string}
     */
    public function assertRecordExists(string $recordUid, ?string $store = null): array
    {
        $recordStore = $store ?: self::ARCHIVE_STORE;

        $exists = DB::table('storage_rows')
            ->where(['store' => $recordStore, 'uid' => $recordUid])
            ->exists();

        if (! $exists) {
            throw new RuntimeException('Record not found.');
        }

        return ['recordStore' => $recordStore, 'recordUid' => $recordUid];
    }

    public function create(string $recordUid, ?string $store, ?string $attachmentId, ?string $notes, ?User $actor): ReviewSession
    {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        $versionToken = $this->resolveVersionToken($recordStore, $recordUid, $attachmentId);

        $session = new ReviewSession([
            'id' => (string) Str::uuid(),
            'record_store' => $recordStore,
            'record_uid' => $recordUid,
            'attachment_id' => $attachmentId,
            'version_token' => $versionToken,
            'state' => ReviewSession::STATE_DRAFT,
            'created_by' => $actor?->getKey(),
            'notes' => $notes,
        ]);
        $session->save();

        return $session;
    }

    public function updateNotes(ReviewSession $session, ?string $notes): ReviewSession
    {
        $session->notes = $notes;
        $session->save();

        return $session;
    }

    public function transition(ReviewSession $session, string $action, ?User $actor, ?string $notes): ReviewSession
    {
        $definition = self::TRANSITIONS[$action] ?? null;
        if ($definition === null) {
            throw new InvalidReviewTransitionException("Unknown review session action: {$action}.");
        }

        if (! in_array($session->state, $definition['from'], true)) {
            throw new InvalidReviewTransitionException(
                "Cannot {$action} a review session in state \"{$session->state}\"."
            );
        }

        if ($action === 'approve') {
            SelfApprovalGuard::assertNotSelfApproving($session->created_by, $actor?->getKey());
        }

        $session->state = $definition['to'];

        if (in_array($action, self::DECISION_ACTIONS, true)) {
            $session->decided_by = $actor?->getKey();
            $session->decided_at = now();
        }

        if ($notes !== null) {
            $session->notes = $notes;
        }

        $session->save();

        return $session;
    }

    /**
     * Whether the session's pinned version_token still matches the record's
     * (or attachment's) live checksum. False means the source was replaced
     * since this session was opened, so any approval on it no longer covers
     * what is currently in place.
     */
    public function isCurrentVersion(ReviewSession $session): bool
    {
        try {
            return $this->resolveVersionToken($session->record_store, $session->record_uid, $session->attachment_id) === $session->version_token;
        } catch (RuntimeException) {
            return false;
        }
    }

    /**
     * Derives the checksum-based version identity for a record or attachment.
     * Public so other media features that need to pin content to a specific
     * version -- e.g. MediaClipService (V3-MEDIA-004) -- share this exact
     * algorithm instead of growing a second, possibly-diverging one. See the
     * class docblock for what the token protects against.
     */
    public function resolveVersionToken(string $recordStore, string $recordUid, ?string $attachmentId): string
    {
        if ($attachmentId !== null) {
            $attachment = DB::table('record_attachments')
                ->where(['id' => $attachmentId, 'record_store' => $recordStore, 'record_uid' => $recordUid])
                ->first();

            if (! $attachment instanceof stdClass) {
                throw new RuntimeException('Attachment not found.');
            }

            return 'attachment:'.$attachment->checksum_sha256;
        }

        $row = DB::table('storage_rows')->where(['store' => $recordStore, 'uid' => $recordUid])->first();
        if (! $row instanceof stdClass) {
            throw new RuntimeException('Record not found.');
        }

        $data = json_decode((string) $row->data, true, flags: JSON_THROW_ON_ERROR);
        $fingerprint = $data['checksum'] ?? $data['filePath'] ?? $data['fileName'] ?? $recordUid;

        return 'record:'.$fingerprint;
    }
}
