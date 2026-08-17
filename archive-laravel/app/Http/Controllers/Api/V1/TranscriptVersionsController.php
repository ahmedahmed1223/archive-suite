<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\TranscriptLockedException;
use App\Http\Controllers\Controller;
use App\Http\Requests\TranscriptVersionRestoreRequest;
use App\Http\Requests\TranscriptVersionStoreRequest;
use App\Models\TranscriptVersion;
use App\Models\User;
use App\Services\Media\CueValidator;
use App\Services\Media\SubtitleCueCodec;
use App\Services\Media\TranscriptVersionService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RuntimeException;

/**
 * Cue-level transcript editing for V3-MEDIA-005: version history, an
 * explicit lock/unlock action so an approved transcript is never silently
 * overwritten, and SRT/VTT export. Distinct from the legacy raw-text
 * endpoints on RecordTranscriptController, which remain unchanged for
 * existing callers.
 */
class TranscriptVersionsController extends Controller
{
    public function __construct(private readonly TranscriptVersionService $versions) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            $current = $this->versions->current($id, $store);
            $history = $this->versions->listVersions($id, $store);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json([
            'ok' => true,
            'current' => $this->formatCurrent($current),
            'versions' => $history->map(fn (TranscriptVersion $version): array => $this->formatVersion($version))->values(),
        ]);
    }

    public function store(TranscriptVersionStoreRequest $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validated();
        $cues = $validated['cues'];

        $cueErrors = CueValidator::validate($cues);
        if ($cueErrors !== []) {
            return response()->json([
                'ok' => false,
                'error' => 'The cue list is invalid.',
                'code' => ApiError::VALIDATION_FAILED,
                'errors' => ['cues' => $cueErrors],
            ], 422);
        }

        try {
            $version = $this->versions->saveVersion(
                $id,
                $validated['store'] ?? null,
                $cues,
                $validated['format'],
                $this->actor($request),
                (bool) ($validated['unlock'] ?? false),
            );
        } catch (TranscriptLockedException $exception) {
            return $this->locked($exception);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json(['ok' => true, 'version' => $this->formatVersion($version)], 201);
    }

    public function lock(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            $version = $this->versions->lock($id, $store, $this->actor($request));
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json(['ok' => true, 'version' => $this->formatVersion($version)]);
    }

    public function restore(TranscriptVersionRestoreRequest $request, string $id, string $versionId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validated();

        try {
            $version = $this->versions->restore(
                $id,
                $validated['store'] ?? null,
                $versionId,
                $this->actor($request),
                (bool) ($validated['unlock'] ?? false),
            );
        } catch (TranscriptLockedException $exception) {
            return $this->locked($exception);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json(['ok' => true, 'version' => $this->formatVersion($version)]);
    }

    public function export(Request $request, string $id, string $format): Response
    {
        if (! in_array($format, ['srt', 'vtt'], true)) {
            abort(404);
        }

        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            $content = $this->versions->export($id, $store, $format);
        } catch (RuntimeException $exception) {
            abort(404, $exception->getMessage());
        }

        $mime = $format === 'vtt' ? 'text/vtt' : 'application/x-subrip';

        return response($content, 200, [
            'Content-Type' => $mime.'; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="transcript.'.$format.'"',
        ]);
    }

    private function actor(Request $request): ?User
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? $user : null;
    }

    private function notFound(RuntimeException $exception): JsonResponse
    {
        return response()->json(ApiError::envelope($exception->getMessage(), 404), 404);
    }

    private function locked(TranscriptLockedException $exception): JsonResponse
    {
        return response()->json(ApiError::envelope($exception->getMessage(), 409, ApiError::CONFLICT), 409);
    }

    /**
     * @param  array{version: TranscriptVersion|null, cues: array<int, array{startSeconds: float, endSeconds: float, text: string}>, format: string, locked: bool}  $current
     * @return array<string, mixed>
     */
    private function formatCurrent(array $current): array
    {
        return [
            'versionId' => $current['version']?->id,
            'cues' => $current['cues'],
            'format' => $current['format'],
            'locked' => $current['locked'],
            'srt' => SubtitleCueCodec::toSrt($current['cues']),
            'vtt' => SubtitleCueCodec::toVtt($current['cues']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatVersion(TranscriptVersion $version): array
    {
        return [
            'id' => $version->id,
            'recordStore' => $version->record_store,
            'recordUid' => $version->record_uid,
            'format' => $version->format,
            'cues' => $version->cues ?? [],
            'locked' => $version->locked,
            'lockedBy' => $version->locked_by,
            'lockedAt' => $version->locked_at?->toISOString(),
            'restoredFromVersionId' => $version->restored_from_version_id,
            'createdBy' => $version->created_by,
            'createdAt' => $version->created_at?->toISOString(),
            'updatedAt' => $version->updated_at?->toISOString(),
        ];
    }
}
