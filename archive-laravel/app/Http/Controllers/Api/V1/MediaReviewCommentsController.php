<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InvalidMediaCommentRangeException;
use App\Exceptions\InvalidReviewTransitionException;
use App\Http\Controllers\Controller;
use App\Http\Requests\MediaReviewCommentCreateRequest;
use App\Http\Requests\MediaReviewCommentUpdateRequest;
use App\Models\MediaReviewComment;
use App\Models\User;
use App\Services\Media\MediaReviewCommentService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class MediaReviewCommentsController extends Controller
{
    public function __construct(private readonly MediaReviewCommentService $comments) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->comments->assertRecordExists($recordId, $store);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        $attachmentId = $request->string('attachmentId')->trim()->toString() ?: null;
        $reviewSessionId = $request->string('reviewSessionId')->trim()->toString() ?: null;

        $comments = MediaReviewComment::query()
            ->where('record_store', $recordStore)
            ->where('record_uid', $recordUid)
            ->when($attachmentId !== null, fn ($query) => $query->where('attachment_id', $attachmentId))
            ->when($reviewSessionId !== null, fn ($query) => $query->where('review_session_id', $reviewSessionId))
            ->orderBy('start_seconds')
            ->get()
            ->map(fn (MediaReviewComment $comment): array => $this->comments->format($comment))
            ->values();

        return response()->json(['ok' => true, 'comments' => $comments]);
    }

    public function store(MediaReviewCommentCreateRequest $request, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validated();

        try {
            $comment = $this->comments->create($recordId, $validated['store'] ?? null, $validated, $this->actor($request));
        } catch (InvalidMediaCommentRangeException $exception) {
            return $this->invalidRange($exception);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json(['ok' => true, 'comment' => $this->comments->format($comment)], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $comment = MediaReviewComment::query()->find($id);
        if (! $comment instanceof MediaReviewComment) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'comment' => $this->comments->format($comment)]);
    }

    public function update(MediaReviewCommentUpdateRequest $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $comment = MediaReviewComment::query()->find($id);
        if (! $comment instanceof MediaReviewComment) {
            return $this->notFound();
        }

        try {
            $comment = $this->comments->update($comment, $request->validated());
        } catch (InvalidMediaCommentRangeException $exception) {
            return $this->invalidRange($exception);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json(['ok' => true, 'comment' => $this->comments->format($comment)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $comment = MediaReviewComment::query()->find($id);
        if (! $comment instanceof MediaReviewComment) {
            return $this->notFound();
        }

        $this->comments->delete($comment);

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    public function resolve(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $comment = MediaReviewComment::query()->find($id);
        if (! $comment instanceof MediaReviewComment) {
            return $this->notFound();
        }

        try {
            $comment = $this->comments->resolve($comment, $this->actor($request));
        } catch (InvalidReviewTransitionException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 409, ApiError::CONFLICT), 409);
        }

        return response()->json(['ok' => true, 'comment' => $this->comments->format($comment)]);
    }

    public function reopen(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $comment = MediaReviewComment::query()->find($id);
        if (! $comment instanceof MediaReviewComment) {
            return $this->notFound();
        }

        try {
            $comment = $this->comments->reopen($comment);
        } catch (InvalidReviewTransitionException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 409, ApiError::CONFLICT), 409);
        }

        return response()->json(['ok' => true, 'comment' => $this->comments->format($comment)]);
    }

    private function actor(Request $request): ?User
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? $user : null;
    }

    private function notFound(?RuntimeException $exception = null): JsonResponse
    {
        return response()->json(ApiError::envelope($exception?->getMessage() ?? 'Media review comment not found.', 404), 404);
    }

    private function invalidRange(InvalidMediaCommentRangeException $exception): JsonResponse
    {
        return response()->json(ApiError::envelope($exception->getMessage(), 422), 422);
    }
}
