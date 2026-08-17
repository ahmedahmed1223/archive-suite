<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Events\MediaReviewCommentBroadcasted;
use App\Exceptions\InvalidMediaCommentRangeException;
use App\Exceptions\InvalidReviewTransitionException;
use App\Models\MediaReviewComment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Owns timeline comment/marker creation, resolve/reopen state, duration
 * range validation, and live-update broadcasting for the unified media
 * studio (V3-MEDIA-003). Record lookups are delegated to
 * ReviewSessionService::assertRecordExists() -- same record/store
 * resolution rule, no reason to duplicate it.
 */
final class MediaReviewCommentService
{
    public function __construct(private readonly ReviewSessionService $records) {}

    /**
     * @return array{recordStore: string, recordUid: string}
     */
    public function assertRecordExists(string $recordUid, ?string $store = null): array
    {
        return $this->records->assertRecordExists($recordUid, $store);
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public function create(string $recordUid, ?string $store, array $input, ?User $actor): MediaReviewComment
    {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        $attachmentId = $input['attachmentId'] ?? null;
        $reviewSessionId = $input['reviewSessionId'] ?? null;

        if ($reviewSessionId !== null && ! DB::table('review_sessions')->where('id', $reviewSessionId)->exists()) {
            throw new RuntimeException('Review session not found.');
        }

        $startSeconds = (float) $input['startSeconds'];
        $endSeconds = isset($input['endSeconds']) ? (float) $input['endSeconds'] : null;

        $this->assertWithinKnownDuration($recordStore, $recordUid, $attachmentId, $startSeconds, $endSeconds, $input['clientDurationSeconds'] ?? null);

        $comment = new MediaReviewComment([
            'id' => (string) Str::uuid(),
            'record_store' => $recordStore,
            'record_uid' => $recordUid,
            'attachment_id' => $attachmentId,
            'review_session_id' => $reviewSessionId,
            'type' => $input['type'],
            'start_seconds' => $startSeconds,
            'end_seconds' => $endSeconds,
            'body' => $input['body'],
            'state' => MediaReviewComment::STATE_OPEN,
            'created_by' => $actor?->getKey(),
        ]);
        $comment->save();

        $this->broadcast($comment, 'created');

        return $comment;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public function update(MediaReviewComment $comment, array $input): MediaReviewComment
    {
        $startSeconds = array_key_exists('startSeconds', $input) ? (float) $input['startSeconds'] : (float) $comment->start_seconds;
        $endSeconds = array_key_exists('endSeconds', $input)
            ? ($input['endSeconds'] !== null ? (float) $input['endSeconds'] : null)
            : ($comment->end_seconds !== null ? (float) $comment->end_seconds : null);

        $this->assertWithinKnownDuration(
            $comment->record_store,
            $comment->record_uid,
            $comment->attachment_id,
            $startSeconds,
            $endSeconds,
            $input['clientDurationSeconds'] ?? null,
        );

        if (array_key_exists('type', $input)) {
            $comment->type = $input['type'];
        }
        if (array_key_exists('body', $input)) {
            $comment->body = $input['body'];
        }
        $comment->start_seconds = $startSeconds;
        $comment->end_seconds = $endSeconds;
        $comment->save();

        $this->broadcast($comment, 'updated');

        return $comment;
    }

    public function resolve(MediaReviewComment $comment, ?User $actor): MediaReviewComment
    {
        if ($comment->state !== MediaReviewComment::STATE_OPEN) {
            throw new InvalidReviewTransitionException('Only an open comment can be resolved.');
        }

        $comment->state = MediaReviewComment::STATE_RESOLVED;
        $comment->resolved_by = $actor?->getKey();
        $comment->resolved_at = now();
        $comment->save();

        $this->broadcast($comment, 'resolved');

        return $comment;
    }

    public function reopen(MediaReviewComment $comment): MediaReviewComment
    {
        if ($comment->state !== MediaReviewComment::STATE_RESOLVED) {
            throw new InvalidReviewTransitionException('Only a resolved comment can be reopened.');
        }

        $comment->state = MediaReviewComment::STATE_OPEN;
        $comment->resolved_by = null;
        $comment->resolved_at = null;
        $comment->save();

        $this->broadcast($comment, 'reopened');

        return $comment;
    }

    public function delete(MediaReviewComment $comment): void
    {
        $recordUid = $comment->record_uid;
        $commentId = $comment->id;
        $comment->delete();

        Event::dispatch(new MediaReviewCommentBroadcasted($recordUid, 'deleted', null, $commentId));
    }

    /**
     * Reject timestamps once a known duration exists for this target. The
     * ceiling comes from record_attachments.duration_seconds when it has
     * already been cached; otherwise the caller's clientDurationSeconds hint
     * (the real duration the browser just measured off the decoded file) is
     * used for this request and cached onto the attachment for next time.
     * ponytail: no attachment (record-level comment) has nowhere durable to
     * cache the hint, so those requests are only bounded when a hint is
     * actually supplied -- acceptable since the studio always plays an
     * attachment in practice.
     */
    private function assertWithinKnownDuration(
        string $recordStore,
        string $recordUid,
        ?string $attachmentId,
        float $startSeconds,
        ?float $endSeconds,
        mixed $clientDurationSeconds,
    ): void {
        if ($endSeconds !== null && $endSeconds <= $startSeconds) {
            throw new InvalidMediaCommentRangeException('endSeconds must be greater than startSeconds.');
        }

        $knownDuration = null;
        $attachmentRow = null;

        if ($attachmentId !== null) {
            $attachmentRow = DB::table('record_attachments')
                ->where(['id' => $attachmentId, 'record_store' => $recordStore, 'record_uid' => $recordUid])
                ->first();

            if ($attachmentRow === null) {
                throw new RuntimeException('Attachment not found.');
            }

            $knownDuration = $attachmentRow->duration_seconds !== null ? (float) $attachmentRow->duration_seconds : null;
        }

        if ($knownDuration === null && $clientDurationSeconds !== null) {
            $knownDuration = (float) $clientDurationSeconds;

            if ($attachmentId !== null) {
                DB::table('record_attachments')
                    ->where('id', $attachmentId)
                    ->update(['duration_seconds' => $knownDuration]);
            }
        }

        if ($knownDuration === null) {
            return;
        }

        $farthestTimestamp = $endSeconds ?? $startSeconds;
        if ($farthestTimestamp > $knownDuration) {
            throw new InvalidMediaCommentRangeException(
                "Timestamp {$farthestTimestamp}s exceeds the media's known duration of {$knownDuration}s."
            );
        }
    }

    private function broadcast(MediaReviewComment $comment, string $action): void
    {
        Event::dispatch(new MediaReviewCommentBroadcasted($comment->record_uid, $action, $this->format($comment)));
    }

    /**
     * @return array<string, mixed>
     */
    public function format(MediaReviewComment $comment): array
    {
        return [
            'id' => $comment->id,
            'recordStore' => $comment->record_store,
            'recordUid' => $comment->record_uid,
            'attachmentId' => $comment->attachment_id,
            'reviewSessionId' => $comment->review_session_id,
            'type' => $comment->type,
            'startSeconds' => (float) $comment->start_seconds,
            'endSeconds' => $comment->end_seconds !== null ? (float) $comment->end_seconds : null,
            'body' => $comment->body,
            'state' => $comment->state,
            'createdBy' => $comment->created_by,
            'resolvedBy' => $comment->resolved_by,
            'resolvedAt' => $comment->resolved_at?->toISOString(),
            'createdAt' => $comment->created_at?->toISOString(),
            'updatedAt' => $comment->updated_at?->toISOString(),
        ];
    }
}
