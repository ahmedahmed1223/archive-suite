<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Domain\Montage\MontageProjectService;
use App\Domain\Montage\MontageRevisionConflict;
use App\Domain\Montage\MontageValidationException;
use App\Http\Controllers\Controller;
use App\Models\MontageProject;
use App\Services\Media\Cmx3600Codec;
use App\Services\Media\ReviewSessionService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class MontageInterchangeController extends Controller
{
    public function __construct(
        private readonly MontageProjectService $projects,
        private readonly ReviewSessionService $versions,
    ) {}

    public function previewCmx(Request $request, string $id, Cmx3600Codec $codec): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $project = MontageProject::query()->find($id);
        $actor = $this->archiveUser($request);
        if (! $project || $actor === null || Gate::forUser($actor)->denies('update', $project)) {
            return response()->json(ApiError::envelope('Montage project not found.', 404), 404);
        }
        $data = $request->validate(['edl' => ['required', 'string', 'max:1048576']]);

        return response()->json(['ok' => true, 'format' => 'cmx3600', 'preview' => $codec->preview($data['edl'])]);
    }

    /** Apply supported CMX cuts only after the editor supplies explicit reel-to-source mappings. */
    public function applyCmx(Request $request, string $id, Cmx3600Codec $codec): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $project = MontageProject::query()->find($id);
        $actor = $this->archiveUser($request);
        if (! $project || $actor === null || Gate::forUser($actor)->denies('saveRevision', $project)) {
            return response()->json(ApiError::envelope('Montage project not found.', 404), 404);
        }

        $data = $request->validate([
            'expectedRevision' => ['required', 'integer', 'min:0'],
            'edl' => ['required', 'string', 'max:1048576'],
            'mappings' => ['required', 'array', 'min:1'],
            'mappings.*.reel' => ['required', 'string', 'max:255'],
            'mappings.*.recordId' => ['required', 'string', 'max:255'],
            'mappings.*.sourceVersionToken' => ['required', 'string', 'max:1024'],
        ]);
        $preview = $codec->preview($data['edl']);
        if ($preview['rejected'] !== []) {
            return response()->json([...ApiError::envelope('CMX contains unsupported events.', 422), 'errors' => ['edl' => $preview['rejected']]], 422);
        }

        $mappings = [];
        foreach ($data['mappings'] as $mapping) {
            if (isset($mappings[$mapping['reel']])) {
                return response()->json([...ApiError::envelope('Duplicate CMX reel mapping.', 422), 'errors' => ['mappings' => 'Each reel may be mapped once.']], 422);
            }
            try {
                $currentToken = $this->versions->resolveVersionToken('archive-items', $mapping['recordId'], null);
            } catch (\RuntimeException) {
                return response()->json([...ApiError::envelope('CMX source mapping is unavailable.', 422), 'errors' => ['mappings' => "Unknown record {$mapping['recordId']}."]], 422);
            }
            if (! hash_equals($currentToken, $mapping['sourceVersionToken'])) {
                return response()->json([...ApiError::envelope('CMX source mapping is stale.', 422), 'errors' => ['mappings' => "Stale source version for {$mapping['reel']}."]], 422);
            }
            $mappings[$mapping['reel']] = $mapping;
        }

        $active = $project->activeRevision();
        $tracks = $active?->tracks ?? $project->tracks ?? [];
        $videoTrack = collect($tracks)->first(fn ($track) => is_array($track) && ($track['kind'] ?? null) === 'video');
        if (! is_array($videoTrack) || ! is_string($videoTrack['id'] ?? null)) {
            $videoTrack = ['id' => 'video-1', 'kind' => 'video', 'name' => 'V1'];
            $tracks[] = $videoTrack;
        }

        $rate = ((int) ($project->frame_rate_numerator ?: $project->fps)) / max(1, (int) ($project->frame_rate_denominator ?: 1));
        $clips = [];
        foreach ($preview['accepted'] as $index => $event) {
            $mapping = $mappings[$event['reel']] ?? null;
            if ($mapping === null) {
                return response()->json([...ApiError::envelope('CMX source mapping is incomplete.', 422), 'errors' => ['mappings' => "No source is mapped for reel {$event['reel']}."]], 422);
            }
            $clips[] = [
                'id' => (string) Str::uuid(),
                'trackId' => $videoTrack['id'],
                'source' => ['recordId' => $mapping['recordId'], 'sourceVersionToken' => $mapping['sourceVersionToken']],
                'timelineStart' => $this->seconds($event['recordIn'], $rate),
                'sourceIn' => $this->seconds($event['sourceIn'], $rate),
                'sourceOut' => $this->seconds($event['sourceOut'], $rate),
            ];
        }

        try {
            $revision = $this->projects->saveRevision($project, [
                'tracks' => $tracks, 'clips' => $clips, 'effects' => [], 'markers' => [], 'comments' => [], 'transitions' => [],
            ], (int) $data['expectedRevision'], $actor);
        } catch (MontageRevisionConflict $exception) {
            return response()->json([...ApiError::envelope('Revision conflict.', 409), 'currentRevision' => $exception->currentRevision], 409);
        } catch (MontageValidationException $exception) {
            return response()->json([...ApiError::envelope('Montage validation failed.', 422), 'errors' => $exception->errors], 422);
        }

        return response()->json(['ok' => true, 'id' => $revision->id, 'projectId' => $project->id, 'revisionNumber' => $revision->revision_number, 'clips' => $revision->clips], 201);
    }

    private function seconds(string $timecode, float $rate): float
    {
        [$hours, $minutes, $seconds, $frames] = array_map('intval', explode(':', $timecode));

        return ($hours * 3600) + ($minutes * 60) + $seconds + ($frames / $rate);
    }
}
