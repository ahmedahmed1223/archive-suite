<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Events\ReviewCommentBroadcasted;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReviewCommentRequest;
use App\Http\Requests\UpdateReviewCommentRequest;
use App\Models\ReviewComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

class ReviewCommentsController extends Controller
{
    public function index(string $mediaUid): JsonResponse
    {
        $comments = ReviewComment::query()
            ->where('media_uid', $mediaUid)
            ->orderBy('timecode_seconds')
            ->get()
            ->map(fn (ReviewComment $comment): array => $this->formatComment($comment))
            ->values();

        return response()->json(['ok' => true, 'comments' => $comments]);
    }

    public function store(string $mediaUid, StoreReviewCommentRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $comment = ReviewComment::query()->create([
            'id' => (string) Str::uuid(),
            'media_uid' => $mediaUid,
            'timecode_seconds' => (float) $validated['timecodeSeconds'],
            'author' => auth()->user()?->email ?? 'anonymous',
            'body' => $validated['body'],
            'annotation' => $validated['annotation'] ?? null,
            'resolved' => false,
        ]);

        $formattedComment = $this->formatComment($comment);

        Event::dispatch(new ReviewCommentBroadcasted($mediaUid, $formattedComment));

        return response()->json(['ok' => true, 'comment' => $formattedComment], 201);
    }

    public function update(string $id, UpdateReviewCommentRequest $request): JsonResponse
    {
        $comment = ReviewComment::query()->findOrFail($id);
        $validated = $request->validated();

        if (isset($validated['body'])) {
            $comment->body = $validated['body'];
        }

        if (isset($validated['resolved'])) {
            $comment->resolved = $validated['resolved'];
        }

        $comment->save();

        $formattedComment = $this->formatComment($comment);

        Event::dispatch(new ReviewCommentBroadcasted($comment->media_uid, $formattedComment));

        return response()->json(['ok' => true, 'comment' => $formattedComment]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatComment(ReviewComment $comment): array
    {
        $timecodeSeconds = $comment->timecode_seconds;
        if (is_string($timecodeSeconds)) {
            $timecodeSeconds = (float) $timecodeSeconds;
        }

        return [
            'id' => $comment->id,
            'mediaUid' => $comment->media_uid,
            'timecodeSeconds' => $timecodeSeconds,
            'author' => $comment->author,
            'body' => $comment->body,
            'annotation' => $comment->annotation,
            'resolved' => $comment->resolved,
            'createdAt' => $comment->created_at?->toISOString(),
            'updatedAt' => $comment->updated_at?->toISOString(),
        ];
    }
}
