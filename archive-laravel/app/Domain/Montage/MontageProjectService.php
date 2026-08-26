<?php

namespace App\Domain\Montage;

use App\Models\MontageProject;
use App\Models\MontageProjectRevision;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MontageProjectService
{
    public function __construct(
        private readonly MontageTimelineValidator $validator,
    ) {}

    /**
     * Save the next revision of a project inside one transaction. A stale
     * expectedRevision throws MontageRevisionConflict and writes nothing.
     */
    public function saveRevision(MontageProject $project, array $payload, int $expectedRevision, User $actor): MontageProjectRevision
    {
        return DB::transaction(function () use ($project, $payload, $expectedRevision, $actor): MontageProjectRevision {
            $project->refresh();

            if ((int) $project->revision !== $expectedRevision) {
                throw new MontageRevisionConflict((int) $project->revision, $expectedRevision);
            }

            $this->validator->assertValid($payload);

            $clips = $payload['clips'] ?? [];

            $revision = MontageProjectRevision::create([
                'montage_project_id' => $project->id,
                'revision_number' => ((int) $project->revision) + 1,
                'created_by' => $actor->id,
                'tracks' => $payload['tracks'] ?? [],
                'clips' => $clips,
                'effects' => $payload['effects'] ?? [],
                'markers' => $payload['markers'] ?? [],
                'comments' => $payload['comments'] ?? [],
                'transitions' => $payload['transitions'] ?? [],
                'source_version_token' => $this->validator->deriveSourceVersionToken($clips),
            ]);

            $project->forceFill([
                'revision' => $revision->revision_number,
                'active_revision_id' => $revision->id,
            ])->save();

            return $revision;
        });
    }

    /** Restore is append-only: copy the historical snapshot into a new revision. */
    public function restoreRevision(
        MontageProject $project,
        MontageProjectRevision $source,
        int $expectedRevision,
        User $actor,
    ): MontageProjectRevision {
        return $this->saveRevision($project, [
            'tracks' => $source->tracks ?? [],
            'clips' => $source->clips ?? [],
            'effects' => $source->effects ?? [],
            'markers' => $source->markers ?? [],
            'comments' => $source->comments ?? [],
            'transitions' => $source->transitions ?? [],
        ], $expectedRevision, $actor);
    }
}
