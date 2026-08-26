<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Montage\MontageProjectService;
use App\Domain\Montage\MontageRevisionConflict;
use App\Domain\Montage\MontageValidationException;
use App\Http\Controllers\Controller;
use App\Models\MontageProject;
use App\Models\MontageProjectRevision;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MontageRevisionsController extends Controller
{
    public function __construct(
        private readonly MontageProjectService $projects,
    ) {}

    /** Save the next revision; a stale expectedRevision becomes a 409. */
    public function store(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $project = MontageProject::query()->find($id);
        if (! $project) {
            return $this->notFound();
        }

        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('saveRevision', $project)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        $data = $request->validate([
            'expectedRevision' => ['required', 'integer', 'min:0'],
            'tracks' => ['present', 'array'],
            'clips' => ['present', 'array'],
            'effects' => ['sometimes', 'array'],
            'markers' => ['sometimes', 'array'],
            'comments' => ['sometimes', 'array'],
            'transitions' => ['sometimes', 'array'],
        ]);

        try {
            $revision = $this->projects->saveRevision(
                $project,
                $data,
                (int) $data['expectedRevision'],
                $actor,
            );
        } catch (MontageRevisionConflict $e) {
            return $this->conflict($e);
        } catch (MontageValidationException $e) {
            return $this->validationError($e);
        }

        return response()->json($this->present($revision), 201);
    }

    /** Full revision history, newest first. */
    public function index(Request $request, string $id): JsonResponse
    {
        $project = MontageProject::with('revisions')->find($id);
        if (! $project) {
            return $this->notFound();
        }

        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('view', $project)) {
            return $this->notFound();
        }

        return response()->json([
            'projectId' => $project->id,
            'currentRevision' => (int) $project->revision,
            'revisions' => $project->revisions
                ->sortByDesc('revision_number')
                ->values()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'revisionNumber' => $r->revision_number,
                    'createdBy' => (string) $r->created_by,
                    'sourceVersionToken' => $r->source_version_token,
                    'clipCount' => count($r->clips ?? []),
                    'createdAt' => $r->created_at?->toIso8601String(),
                ]),
        ]);
    }

    /** Restore a historical snapshot by appending a new immutable revision. */
    public function restore(Request $request, string $id, string $revisionId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $project = MontageProject::query()->find($id);
        if (! $project) {
            return $this->notFound();
        }

        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('restoreRevision', $project)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        $data = $request->validate([
            'expectedRevision' => ['required', 'integer', 'min:1'],
        ]);
        $source = $project->revisions()->whereKey($revisionId)->first();
        if (! $source) {
            return $this->notFound();
        }

        try {
            $revision = $this->projects->restoreRevision(
                $project,
                $source,
                (int) $data['expectedRevision'],
                $actor,
            );
        } catch (MontageRevisionConflict $e) {
            return $this->conflict($e);
        } catch (MontageValidationException $e) {
            return $this->validationError($e);
        }

        return response()->json($this->present($revision), 201);
    }

    private function conflict(MontageRevisionConflict $exception): JsonResponse
    {
        return response()->json([
            ...ApiError::envelope('Revision conflict.', 409),
            'currentRevision' => $exception->currentRevision,
            'expectedRevision' => $exception->expectedRevision,
        ], 409);
    }

    private function validationError(MontageValidationException $exception): JsonResponse
    {
        return response()->json([
            ...ApiError::envelope('Montage validation failed.', 422),
            'errors' => $exception->errors,
        ], 422);
    }

    private function notFound(): JsonResponse
    {
        return response()->json(ApiError::envelope('Montage project or revision not found.', 404), 404);
    }

    /** @return array<string, mixed> */
    private function present(MontageProjectRevision $revision): array
    {
        return [
            'id' => $revision->id,
            'projectId' => $revision->montage_project_id,
            'revisionNumber' => $revision->revision_number,
            'createdBy' => (string) $revision->created_by,
            'tracks' => $revision->tracks ?? [],
            'clips' => $revision->clips ?? [],
            'effects' => $revision->effects ?? [],
            'markers' => $revision->markers ?? [],
            'comments' => $revision->comments ?? [],
            'transitions' => $revision->transitions ?? [],
            'sourceVersionToken' => $revision->source_version_token,
            'createdAt' => $revision->created_at?->toIso8601String(),
        ];
    }
}
