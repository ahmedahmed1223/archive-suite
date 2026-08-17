<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DecideReviewLinkRequest;
use App\Http\Requests\StoreReviewLinkRequest;
use App\Models\MediaDerivative;
use App\Models\ReviewComment;
use App\Models\ReviewLink;
use App\Models\User;
use App\Services\Media\ExternalReviewService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * V3-MEDIA-007: external (public, token-gated) media review. The original
 * view/comment-only link (create/show below) is extended, not replaced --
 * see ExternalReviewService for the version-pinning, derivative-preference,
 * and decision/report logic this controller delegates to.
 */
class ReviewLinksController extends Controller
{
    public function __construct(private readonly ExternalReviewService $externalReview) {}

    public function store(string $mediaUid, StoreReviewLinkRequest $request): JsonResponse
    {
        // Not gated behind requireEditor(): this route has only ever
        // required archive.auth (any authenticated role) -- see
        // ReviewLinksApiTest's plain (default "viewer" role) login() fixture.
        // Adding an editor requirement here would be a real, undocumented
        // behavior change, not something this task asked for.
        try {
            $reviewLink = $this->externalReview->createLink($mediaUid, $request->validated(), $this->actor($request));
        } catch (RuntimeException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 422), 422);
        }

        return response()->json([
            'ok' => true,
            'token' => $reviewLink->token,
            'url' => url('/review/'.$reviewLink->token),
            'path' => '/review/'.$reviewLink->token,
            'mediaUid' => $reviewLink->media_uid,
            'permission' => $reviewLink->permission,
            'expiresAt' => $reviewLink->expires_at?->toISOString(),
            'allowDownload' => $reviewLink->allow_download,
            'watermarkPolicy' => $reviewLink->watermark_policy,
            'requiredApprovals' => $reviewLink->required_approvals,
        ], 201);
    }

    public function show(string $token): JsonResponse
    {
        $reviewLink = $this->findActiveLink($token);
        if (! $reviewLink instanceof ReviewLink) {
            return $this->notFound();
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
            'review' => $this->formatReviewMetadata($reviewLink),
            'comments' => $comments,
        ]);
    }

    /**
     * Streams the media bytes for this link: a ready, still-current
     * derivative when one is attached (preferred, per the V3-MEDIA-006
     * reuse acceptance criterion), otherwise the link's own server-resolved
     * source. Never exposes a path/disk to the caller and never falls open
     * on an expired token.
     */
    public function media(Request $request, string $token): Response
    {
        $reviewLink = $this->findActiveLink($token);
        if (! $reviewLink instanceof ReviewLink) {
            return response()->json(ApiError::envelope('Review link not found.', 404), 404);
        }

        $resolved = $this->externalReview->resolveMediaSource($reviewLink);
        if ($resolved === null) {
            return response()->json(ApiError::envelope('Media is not available for this review link.', 404), 404);
        }

        $mime = mime_content_type($resolved['absolutePath']) ?: 'application/octet-stream';
        $disposition = ($reviewLink->allow_download && $request->boolean('download')) ? 'attachment' : 'inline';

        return response()->file($resolved['absolutePath'], [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition,
            'Cache-Control' => 'private, max-age=0, no-cache',
            'X-Review-Watermark-Policy' => $reviewLink->watermark_policy,
            'X-Review-Media-Kind' => $resolved['kind'],
        ]);
    }

    /**
     * Records one external reviewer's approve / request-changes decision.
     * Fails closed on an expired token -- an expired link must reject every
     * action, not just the read.
     */
    public function decide(DecideReviewLinkRequest $request, string $token): JsonResponse
    {
        $reviewLink = $this->findActiveLink($token);
        if (! $reviewLink instanceof ReviewLink) {
            return response()->json(ApiError::envelope('Review link not found or expired.', 404), 404);
        }

        $validated = $request->validated();

        try {
            $result = $this->externalReview->recordDecision(
                $reviewLink,
                $validated['reviewerName'],
                $validated['reviewerEmail'] ?? null,
                $validated['decision'],
                $validated['notes'] ?? null,
                $request->ip(),
                $request->userAgent(),
            );
        } catch (RuntimeException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 404), 404);
        }

        return response()->json([
            'ok' => true,
            'decision' => [
                'id' => $result['decision']->id,
                'reviewerName' => $result['decision']->reviewer_name,
                'decision' => $result['decision']->decision,
                'decidedAt' => $result['decision']->created_at?->toISOString(),
            ],
            'session' => $result['session'] !== null ? ['state' => $result['session']->state] : null,
            'approvals' => [
                'required' => $reviewLink->required_approvals,
                'received' => $result['approvalsReceived'],
            ],
        ], 201);
    }

    /**
     * Internal-only audit report: proves which version was reviewed, who
     * the reviewers were, and what the decision was. Kept off the public
     * token surface (unlike show()/media()/decide()) so one external
     * reviewer's name/email is never exposed to another via the link itself
     * -- see ExternalReviewService::buildReport() for the full shape.
     */
    public function report(Request $request, string $token): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $reviewLink = ReviewLink::query()->where('token', $token)->first();
        if (! $reviewLink instanceof ReviewLink) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'report' => $this->externalReview->buildReport($reviewLink)]);
    }

    private function findActiveLink(string $token): ?ReviewLink
    {
        $reviewLink = ReviewLink::query()->where('token', $token)->first();

        if (! $reviewLink instanceof ReviewLink || $reviewLink->isExpired()) {
            return null;
        }

        return $reviewLink;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatReviewMetadata(ReviewLink $reviewLink): array
    {
        $derivative = $reviewLink->derivative_id !== null ? MediaDerivative::query()->find($reviewLink->derivative_id) : null;

        return [
            'permission' => $reviewLink->permission,
            'expiresAt' => $reviewLink->expires_at?->toISOString(),
            'createdAt' => $reviewLink->created_at?->toISOString(),
            'updatedAt' => $reviewLink->updated_at?->toISOString(),
            'allowDownload' => $reviewLink->allow_download,
            'watermarkPolicy' => $reviewLink->watermark_policy,
            'requiredApprovals' => $reviewLink->required_approvals,
            'versionToken' => $reviewLink->version_token,
            'isCurrentVersion' => $this->externalReview->isCurrentVersion($reviewLink),
            // Deliberately no reviewer names/emails here -- see report()
            // docblock. Counts only, safe for one reviewer to see alongside
            // their own submission in a dual-approval flow.
            'derivative' => $derivative instanceof MediaDerivative ? [
                'id' => $derivative->id,
                'derivativeType' => $derivative->derivative_type,
                'status' => $derivative->status,
            ] : null,
        ];
    }

    private function actor(Request $request): ?User
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? $user : null;
    }

    private function notFound(): JsonResponse
    {
        return response()->json(ApiError::envelope('Review link not found.', 404), 404);
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
