<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MediaClipCreateRequest;
use App\Http\Requests\MediaClipUpdateRequest;
use App\Models\MediaClip;
use App\Models\User;
use App\Services\Media\MediaClipService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * Non-destructive clip lists tied to a record + version (V3-MEDIA-004).
 * See MediaClipService for the version-identity model this reuses from
 * review sessions (V3-MEDIA-002).
 */
class ClipsController extends Controller
{
    public function __construct(private readonly MediaClipService $clips) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->clips->assertRecordExists($recordId, $store);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        $clips = $this->scopedClips($request, $recordStore, $recordUid)
            ->map(fn (MediaClip $clip): array => $this->format($clip))
            ->values();

        return response()->json(['ok' => true, 'clips' => $clips]);
    }

    public function store(MediaClipCreateRequest $request, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validated();

        try {
            $clip = $this->clips->create(
                $recordId,
                $validated['store'] ?? null,
                $validated['attachmentId'] ?? null,
                $validated['title'],
                $validated['notes'] ?? null,
                (float) $validated['inSeconds'],
                (float) $validated['outSeconds'],
                (int) ($validated['fps'] ?? 25),
                $this->actor($request),
            );
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        return response()->json(['ok' => true, 'clip' => $this->format($clip)], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $clip = MediaClip::query()->find($id);
        if (! $clip instanceof MediaClip) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'clip' => $this->format($clip)]);
    }

    public function update(MediaClipUpdateRequest $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $clip = MediaClip::query()->find($id);
        if (! $clip instanceof MediaClip) {
            return $this->notFound();
        }

        $clip = $this->clips->update($clip, $request->validated());

        return response()->json(['ok' => true, 'clip' => $this->format($clip)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $clip = MediaClip::query()->find($id);
        if (! $clip instanceof MediaClip) {
            return $this->notFound();
        }

        $clip->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * Exports the clip list for a record so it can be replayed against the
     * source later, outside this app -- every row/entry carries the
     * record+attachment identity, the pinned version token, and the frame
     * rate alongside the in/out timecodes, so the export is unambiguous on
     * its own (see V3-MEDIA-004 acceptance criteria).
     */
    public function export(Request $request, string $recordId): JsonResponse|Response
    {
        $format = (string) $request->query('format', 'json');
        if (! in_array($format, ['json', 'csv'], true)) {
            return response()->json(ApiError::envelope('Invalid format. Use json or csv.', 422), 422);
        }

        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->clips->assertRecordExists($recordId, $store);
        } catch (RuntimeException $exception) {
            return $this->notFound($exception);
        }

        $clips = $this->scopedClips($request, $recordStore, $recordUid);

        if ($format === 'json') {
            return response()->json([
                'ok' => true,
                'recordStore' => $recordStore,
                'recordUid' => $recordUid,
                'clips' => $clips->map(fn (MediaClip $clip): array => $this->format($clip))->values(),
            ]);
        }

        $csv = "id,title,notes,inSeconds,outSeconds,fps,recordStore,recordUid,attachmentId,versionToken,isCurrentVersion,createdAt\n";
        foreach ($clips as $clip) {
            $csv .= $this->csvLine($clip);
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="clip-list-'.$recordUid.'.csv"',
        ]);
    }

    /**
     * @return Collection<int, MediaClip>
     */
    private function scopedClips(Request $request, string $recordStore, string $recordUid): Collection
    {
        $attachmentId = $request->string('attachmentId')->trim()->toString() ?: null;

        return MediaClip::query()
            ->where('record_store', $recordStore)
            ->where('record_uid', $recordUid)
            ->when($attachmentId !== null, fn ($query) => $query->where('attachment_id', $attachmentId))
            ->orderBy('in_seconds')
            ->get();
    }

    private function actor(Request $request): ?User
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? $user : null;
    }

    private function notFound(?RuntimeException $exception = null): JsonResponse
    {
        return response()->json(ApiError::envelope($exception?->getMessage() ?? 'Not found.', 404), 404);
    }

    private function csvLine(MediaClip $clip): string
    {
        $fields = [
            $clip->id,
            $clip->title,
            (string) ($clip->notes ?? ''),
            (string) $clip->in_seconds,
            (string) $clip->out_seconds,
            (string) $clip->fps,
            $clip->record_store,
            $clip->record_uid,
            (string) ($clip->attachment_id ?? ''),
            $clip->version_token,
            $this->clips->isCurrentVersion($clip) ? 'true' : 'false',
            (string) ($clip->created_at?->toISOString() ?? ''),
        ];

        $escaped = array_map(function ($field): string {
            $field = (string) $field;

            return preg_match('/[",\n]/', $field) === 1
                ? '"'.str_replace('"', '""', $field).'"'
                : $field;
        }, $fields);

        return implode(',', $escaped)."\n";
    }

    /**
     * @return array<string, mixed>
     */
    private function format(MediaClip $clip): array
    {
        return [
            'id' => $clip->id,
            'recordStore' => $clip->record_store,
            'recordUid' => $clip->record_uid,
            'attachmentId' => $clip->attachment_id,
            'versionToken' => $clip->version_token,
            'isCurrentVersion' => $this->clips->isCurrentVersion($clip),
            'title' => $clip->title,
            'notes' => $clip->notes,
            'inSeconds' => $clip->in_seconds,
            'outSeconds' => $clip->out_seconds,
            'fps' => $clip->fps,
            'createdBy' => $clip->created_by,
            'createdAt' => $clip->created_at?->toISOString(),
            'updatedAt' => $clip->updated_at?->toISOString(),
        ];
    }
}
