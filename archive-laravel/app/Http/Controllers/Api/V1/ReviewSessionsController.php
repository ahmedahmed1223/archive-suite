<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InvalidReviewTransitionException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReviewSessionCreateRequest;
use App\Http\Requests\ReviewSessionTransitionRequest;
use App\Http\Requests\ReviewSessionUpdateRequest;
use App\Models\ReviewSession;
use App\Models\User;
use App\Services\Media\ReviewSessionService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ReviewSessionsController extends Controller
{
    public function __construct(private readonly ReviewSessionService $sessions) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->sessions->assertRecordExists($recordId, $store);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        $attachmentId = $request->string('attachmentId')->trim()->toString() ?: null;

        $sessions = ReviewSession::query()
            ->where('record_store', $recordStore)
            ->where('record_uid', $recordUid)
            ->when($attachmentId !== null, fn ($query) => $query->where('attachment_id', $attachmentId))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ReviewSession $session): array => $this->format($session))
            ->values();

        return response()->json(['ok' => true, 'sessions' => $sessions]);
    }

    public function store(ReviewSessionCreateRequest $request, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validated();

        try {
            $session = $this->sessions->create(
                $recordId,
                $validated['store'] ?? null,
                $validated['attachmentId'] ?? null,
                $validated['notes'] ?? null,
                $this->actor($request),
            );
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json(['ok' => true, 'session' => $this->format($session)], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $session = ReviewSession::query()->find($id);
        if (! $session instanceof ReviewSession) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'session' => $this->format($session)]);
    }

    public function update(ReviewSessionUpdateRequest $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $session = ReviewSession::query()->find($id);
        if (! $session instanceof ReviewSession) {
            return $this->notFound();
        }

        $session = $this->sessions->updateNotes($session, $request->validated()['notes'] ?? null);

        return response()->json(['ok' => true, 'session' => $this->format($session)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $session = ReviewSession::query()->find($id);
        if (! $session instanceof ReviewSession) {
            return $this->notFound();
        }

        $session->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    public function start(ReviewSessionTransitionRequest $request, string $id): JsonResponse
    {
        return $this->applyTransition($request, $id, 'start');
    }

    public function requestChanges(ReviewSessionTransitionRequest $request, string $id): JsonResponse
    {
        return $this->applyTransition($request, $id, 'request_changes');
    }

    public function approve(ReviewSessionTransitionRequest $request, string $id): JsonResponse
    {
        return $this->applyTransition($request, $id, 'approve');
    }

    public function resume(ReviewSessionTransitionRequest $request, string $id): JsonResponse
    {
        return $this->applyTransition($request, $id, 'resume');
    }

    public function close(ReviewSessionTransitionRequest $request, string $id): JsonResponse
    {
        return $this->applyTransition($request, $id, 'close');
    }

    private function applyTransition(ReviewSessionTransitionRequest $request, string $id, string $action): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $session = ReviewSession::query()->find($id);
        if (! $session instanceof ReviewSession) {
            return $this->notFound();
        }

        try {
            $session = $this->sessions->transition($session, $action, $this->actor($request), $request->validated()['notes'] ?? null);
        } catch (InvalidReviewTransitionException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 409, ApiError::CONFLICT), 409);
        }

        return response()->json(['ok' => true, 'session' => $this->format($session)]);
    }

    private function actor(Request $request): ?User
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? $user : null;
    }

    private function notFound(?RuntimeException $exception = null): JsonResponse
    {
        return response()->json(ApiError::envelope($exception?->getMessage() ?? 'Review session not found.', 404), 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function format(ReviewSession $session): array
    {
        return [
            'id' => $session->id,
            'recordStore' => $session->record_store,
            'recordUid' => $session->record_uid,
            'attachmentId' => $session->attachment_id,
            'versionToken' => $session->version_token,
            'isCurrentVersion' => $this->sessions->isCurrentVersion($session),
            'state' => $session->state,
            'notes' => $session->notes,
            'createdBy' => $session->created_by,
            'decidedBy' => $session->decided_by,
            'decidedAt' => $session->decided_at?->toISOString(),
            'createdAt' => $session->created_at?->toISOString(),
            'updatedAt' => $session->updated_at?->toISOString(),
        ];
    }
}
