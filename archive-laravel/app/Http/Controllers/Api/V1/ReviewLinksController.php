<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReviewLinkRequest;
use App\Models\ReviewComment;
use App\Models\ReviewLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ReviewLinksController extends Controller
{
    public function store(string $mediaUid, StoreReviewLinkRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $token = Str::random(64);

        $reviewLink = ReviewLink::query()->create([
            'token' => $token,
            'media_uid' => $mediaUid,
            'permission' => $validated['permission'] ?? 'view',
            'expires_at' => $validated['expiresAt'] ?? null,
        ]);

        return response()->json([
            'ok' => true,
            'token' => $reviewLink->token,
            'url' => url('/review/'.$reviewLink->token),
            'path' => '/review/'.$reviewLink->token,
            'mediaUid' => $reviewLink->media_uid,
            'permission' => $reviewLink->permission,
            'expiresAt' => $reviewLink->expires_at?->toISOString(),
        ], 201);
    }

    public function show(string $token): JsonResponse
    {
        $reviewLink = ReviewLink::query()->where('token', $token)->first();

        if (! $reviewLink || ($reviewLink->expires_at && $reviewLink->expires_at->isPast())) {
            return response()->json(['ok' => false, 'error' => 'Review link not found.'], 404);
        }

        $comments = ReviewComment::query()
            ->where('media_uid', $reviewLink->media_uid)
            ->orderBy('timecode_seconds')
            ->get()
            ->map(fn (ReviewComment $comment): array => $this->formatComment($comment))
            ->values()
            ->all();

        return response()->json([
            'ok' => true,
            'mediaUid' => $reviewLink->media_uid,
            'review' => [
                'permission' => $reviewLink->permission,
                'expiresAt' => $reviewLink->expires_at?->toISOString(),
                'createdAt' => $reviewLink->created_at?->toISOString(),
                'updatedAt' => $reviewLink->updated_at?->toISOString(),
            ],
            'comments' => $comments,
        ]);
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
