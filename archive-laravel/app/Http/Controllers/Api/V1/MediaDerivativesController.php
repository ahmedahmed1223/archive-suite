<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaDerivative;
use App\Models\MediaJob;
use App\Models\User;
use App\Services\Media\MediaDerivativeService;
use App\Services\Media\MediaJobExecutor;
use App\Services\Media\MediaJobProgressBroadcaster;
use App\Services\Media\MediaPathGuard;
use App\Services\Media\MediaQueueStatusBroadcaster;
use App\Support\ApiError;
use App\Support\RequestCorrelation;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Cached, version-pinned media derivatives -- thumbnail, waveform, and
 * lightweight preview (proxy) copies (V3-MEDIA-006). See
 * MediaDerivativeService for the version + settings identity model this
 * reuses from review sessions (V3-MEDIA-002) and clips (V3-MEDIA-004), and
 * RealMediaProcessor::processDerivative() for how generation actually runs
 * through the existing MediaJob queue.
 */
class MediaDerivativesController extends Controller
{
    private const TYPES = ['thumbnail', 'waveform', 'proxy'];

    public function __construct(private readonly MediaDerivativeService $derivatives) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->derivatives->assertRecordExists($recordId, $store);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        $attachmentId = $request->string('attachmentId')->trim()->toString() ?: null;
        $type = $request->string('type')->trim()->toString() ?: null;

        $derivatives = MediaDerivative::query()
            ->where('record_store', $recordStore)
            ->where('record_uid', $recordUid)
            ->when($attachmentId !== null, fn ($query) => $query->where('attachment_id', $attachmentId))
            ->when($type !== null, fn ($query) => $query->where('derivative_type', $type))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (MediaDerivative $derivative): array => $this->format($derivative))
            ->values();

        return response()->json(['ok' => true, 'derivatives' => $derivatives]);
    }

    /**
     * Requests a derivative for a record + version + settings combination.
     * Returns the existing row unchanged (200, cached=true) when one is
     * already ready or already in flight for this exact cache key;
     * otherwise dispatches a fresh MediaJob (202, cached=false).
     */
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $safePathRule = function (string $attribute, mixed $value, Closure $fail): void {
            if (! MediaPathGuard::isSafeRelative((string) $value)) {
                $fail("The {$attribute} must be a relative path without \"..\" traversal or an absolute path.");
            }
        };

        $validated = $request->validate([
            'recordId' => ['required', 'string', 'max:255'],
            'store' => ['nullable', 'string', 'max:255'],
            'attachmentId' => ['nullable', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(self::TYPES)],
            'sourcePath' => ['required', 'string', 'max:2048', $safePathRule],
            'settings' => ['nullable', 'array'],
            'settings.atSec' => ['nullable', 'numeric', 'min:0'],
            'settings.width' => ['nullable', 'integer', 'min:16', 'max:4096'],
            'settings.height' => ['nullable', 'integer', 'min:16', 'max:2048'],
            'settings.color' => ['nullable', 'string', 'max:6'],
            'settings.maxWidth' => ['nullable', 'integer', 'min:64', 'max:4096'],
            'settings.videoBitrateKbps' => ['nullable', 'integer', 'min:64', 'max:8000'],
            'settings.accelerate' => ['nullable', 'boolean'],
        ]);

        try {
            $found = $this->derivatives->findOrBuildPending(
                $validated['recordId'],
                $validated['store'] ?? null,
                $validated['attachmentId'] ?? null,
                $validated['type'],
                $validated['settings'] ?? [],
                $this->actor($request),
            );
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        $derivative = $found['derivative'];

        if (! $found['isNew']) {
            return response()->json([
                'ok' => true,
                'derivative' => $this->format($derivative),
                'cached' => true,
            ]);
        }

        // V3-PERF-005 backpressure, mirrored from MediaJobsController::store
        // -- derivatives dispatch onto the same 'default' queue and share
        // its capacity ceiling.
        $maxQueued = (int) config('media.max_queued_jobs_per_queue', 50);
        $currentDepth = app(MediaQueueStatusBroadcaster::class)->counts()['default'] ?? 0;
        if ($currentDepth >= $maxQueued) {
            return response()->json(
                ApiError::envelope('Media processing queue is at capacity. Try again shortly.', 429),
                429,
                ['Retry-After' => '30'],
            );
        }

        $executor = app(MediaJobExecutor::class);
        $mediaJob = MediaJob::query()->create([
            'id' => (string) Str::uuid(),
            'record_id' => $derivative->record_uid,
            'created_by' => $this->userId($request),
            'operation' => 'derivative',
            'status' => 'queued',
            'queue' => 'default',
            'executor' => $executor->name(),
            'contract_version' => (int) config('media.job_contract_version', 1),
            'source_path' => $validated['sourcePath'],
            'options' => [
                'derivativeId' => $derivative->id,
                'derivativeType' => $derivative->derivative_type,
                'settings' => $derivative->settings,
            ],
            'queued_at' => now(),
        ]);

        $this->derivatives->attachJob($derivative, $mediaJob);

        ProcessMediaWorkflow::dispatch($mediaJob->id, RequestCorrelation::id())->onQueue('default');
        app(MediaJobProgressBroadcaster::class)->notify($mediaJob);

        return response()->json([
            'ok' => true,
            'derivative' => $this->format($derivative->fresh()),
            'cached' => false,
        ], 202);
    }

    /**
     * Reads a derivative by id. isCurrentVersion is always computed fresh
     * against the live source -- a stale derivative is still returned (the
     * caller may still want its storageKey/status) but never with
     * isCurrentVersion silently true, mirroring ReviewSessionsController and
     * ClipsController.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $derivative = MediaDerivative::query()->find($id);
        if (! $derivative instanceof MediaDerivative) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'derivative' => $this->format($derivative)]);
    }

    private function actor(Request $request): ?User
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? $user : null;
    }

    private function userId(Request $request): ?string
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? (string) $user->getKey() : null;
    }

    private function notFound(?RuntimeException $exception = null): JsonResponse
    {
        return response()->json(ApiError::envelope($exception?->getMessage() ?? 'Not found.', 404), 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function format(MediaDerivative $derivative): array
    {
        return [
            'id' => $derivative->id,
            'recordStore' => $derivative->record_store,
            'recordUid' => $derivative->record_uid,
            'attachmentId' => $derivative->attachment_id,
            'derivativeType' => $derivative->derivative_type,
            'versionToken' => $derivative->version_token,
            'isCurrentVersion' => $this->derivatives->isCurrentVersion($derivative),
            'settings' => $derivative->settings,
            'status' => $derivative->status,
            'storageKey' => $derivative->storage_key,
            'mediaJobId' => $derivative->media_job_id,
            'error' => $derivative->error,
            'createdBy' => $derivative->created_by,
            'createdAt' => $derivative->created_at?->toISOString(),
            'updatedAt' => $derivative->updated_at?->toISOString(),
        ];
    }
}
