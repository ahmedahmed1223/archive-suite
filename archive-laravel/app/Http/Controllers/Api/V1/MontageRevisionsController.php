<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Montage\MontageProjectService;
use App\Domain\Montage\MontageRevisionConflict;
use App\Http\Controllers\Controller;
use App\Models\MontageProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MontageRevisionsController extends Controller
{
    public function __construct(
        private readonly MontageProjectService $projects,
    ) {
    }

    /** Save the next revision; a stale expectedRevision becomes a 409. */
    public function store(Request $request, string $id): JsonResponse
    {
        $project = MontageProject::findOrFail($id);
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
                $request->user(),
            );
        } catch (MontageRevisionConflict $e) {
            return response()->json([
                'error' => 'revision_conflict',
                'currentRevision' => $e->currentRevision,
                'expectedRevision' => $e->expectedRevision,
            ], 409);
        }

        return response()->json([
            'id' => $revision->id,
            'projectId' => $revision->montage_project_id,
            'revisionNumber' => $revision->revision_number,
            'tracks' => $revision->tracks,
            'clips' => $revision->clips,
            'sourceVersionToken' => $revision->source_version_token,
            'createdAt' => $revision->created_at?->toIso8601String(),
        ], 201);
    }

    /** Full revision history, newest first. */
    public function index(string $id): JsonResponse
    {
        $project = MontageProject::with('revisions')->findOrFail($id);

        return response()->json([
            'projectId' => $project->id,
            'currentRevision' => (int) $project->revision,
            'revisions' => $project->revisions
                ->sortByDesc('revision_number')
                ->values()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'revisionNumber' => $r->revision_number,
                    'createdBy' => $r->created_by,
                    'sourceVersionToken' => $r->source_version_token,
                    'clipCount' => count($r->clips ?? []),
                    'createdAt' => $r->created_at?->toIso8601String(),
                ]),
        ]);
    }
}
