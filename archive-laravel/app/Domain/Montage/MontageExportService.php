<?php

namespace App\Domain\Montage;

use App\Models\MontageExport;
use App\Models\MontageProject;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MontageExportService
{
    public function __construct(
        private readonly MontageRenderManifestBuilder $manifests,
    ) {
    }

    /**
     * Request an export for a specific revision+preset. A repeat request for
     * the same in-flight export returns the existing row (idempotent).
     */
    public function request(MontageProject $project, int $expectedRevision, string $preset, User $actor): MontageExport
    {
        return DB::transaction(function () use ($project, $expectedRevision, $preset, $actor): MontageExport {
            $project->refresh();

            if ((int) $project->revision !== $expectedRevision) {
                throw new MontageRevisionConflict((int) $project->revision, $expectedRevision);
            }

            $revision = $project->activeRevision();
            if ($revision === null) {
                throw new MontageValidationException(['revision' => 'Project has no revision to export.']);
            }

            // Idempotency: same project+revision+preset still queued/processing.
            $existing = MontageExport::where('montage_project_id', $project->id)
                ->where('montage_project_revision_id', $revision->id)
                ->where('preset', $preset)
                ->whereIn('status', ['queued', 'processing'])
                ->first();
            if ($existing !== null) {
                return $existing;
            }

            $manifest = $this->manifests->build($preset, $revision->id, $revision->clips ?? []);

            return MontageExport::create([
                'montage_project_id' => $project->id,
                'montage_project_revision_id' => $revision->id,
                'requested_by' => $actor->id,
                'preset' => $preset,
                'status' => 'queued',
                'progress' => 0,
                'settings' => $manifest->toArray(),
            ]);
        });
    }
}
