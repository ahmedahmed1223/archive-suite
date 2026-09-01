<?php

namespace App\Domain\Montage;

use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaDerivative;
use App\Models\MediaJob;
use App\Models\MontageExport;
use App\Models\MontageProject;
use App\Models\User;
use App\Services\Media\MediaJobExecutor;
use App\Services\Media\MediaJobProgressBroadcaster;
use App\Services\Media\MediaJobQueueRouter;
use App\Support\RequestCorrelation;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MontageExportService
{
    public function __construct(
        private readonly MontageRenderManifestBuilder $manifests,
        private readonly MontageExportQc $qc,
        private readonly MediaJobExecutor $executor,
        private readonly MediaJobQueueRouter $queues,
        private readonly MediaJobProgressBroadcaster $progress,
    ) {}

    /**
     * Request an export for a specific revision+preset. A repeat request for
     * the same in-flight export returns the existing row (idempotent).
     */
    public function request(MontageProject $project, int $expectedRevision, string $preset, User $actor): MontageExport
    {
        $idempotencyKey = hash('sha256', implode('|', [$project->getKey(), (string) $expectedRevision, $preset]));

        try {
            return DB::transaction(function () use ($project, $expectedRevision, $preset, $actor, $idempotencyKey): MontageExport {
                $project = MontageProject::query()->lockForUpdate()->findOrFail($project->getKey());

                if ((int) $project->revision !== $expectedRevision) {
                    throw new MontageRevisionConflict((int) $project->revision, $expectedRevision);
                }

                $revision = $project->revisions()
                    ->where('revision_number', $expectedRevision)
                    ->whereKey($project->active_revision_id)
                    ->first();
                if ($revision === null) {
                    throw new MontageValidationException(['revision' => 'Project has no revision to export.']);
                }

                // A stable DB-backed key closes the read-before-insert race for
                // concurrent duplicate HTTP requests.
                $existing = MontageExport::query()->where('idempotency_key', $idempotencyKey)->first();
                if ($existing !== null) {
                    return $existing;
                }

                $manifest = $this->manifests->build($preset, $revision->id, $revision->clips ?? [], $actor);
                $this->qc->assertReady($revision, $manifest);

                $export = MontageExport::create([
                    'montage_project_id' => $project->id,
                    'montage_project_revision_id' => $revision->id,
                    'requested_by' => $actor->id,
                    'idempotency_key' => $idempotencyKey,
                    'preset' => $preset,
                    'status' => 'queued',
                    'progress' => 0,
                    'settings' => $manifest->toArray(),
                ]);

                $queue = $this->queues->queueFor('montage_export');
                $mediaJob = MediaJob::query()->create([
                    'id' => (string) Str::uuid(),
                    'record_id' => "montage-projects/{$project->id}/exports/{$export->id}",
                    'created_by' => $actor->getKey(),
                    'operation' => 'montage_export',
                    'status' => 'queued',
                    'queue' => $queue,
                    'executor' => $this->executor->name(),
                    'contract_version' => (int) config('media.job_contract_version', 1),
                    'source_path' => $manifest->clips[0]['path'] ?? null,
                    'options' => [
                        'exportId' => $export->id,
                        'revisionId' => $revision->id,
                        'preset' => $preset,
                        'manifest' => $manifest->toArray(),
                        'clips' => array_map(static fn (array $clip): array => [
                            'path' => $clip['path'],
                            'inSec' => $clip['sourceIn'],
                            'outSec' => $clip['sourceIn'] + $clip['durationSeconds'],
                            'timelineStart' => $clip['timelineStart'],
                        ], $manifest->clips),
                    ],
                    'queued_at' => now(),
                ]);
                $export->forceFill(['media_job_id' => $mediaJob->id])->save();

                $manifestSettings = $manifest->toArray();
                $derivative = MediaDerivative::query()->create([
                    'id' => (string) Str::uuid(),
                    'record_store' => 'montage-projects',
                    'record_uid' => (string) $project->getKey(),
                    'derivative_type' => 'montage_export',
                    'version_token' => (string) ($revision->source_version_token ?? "revision:{$revision->id}"),
                    'settings' => $manifestSettings,
                    'settings_hash' => hash('sha256', json_encode($manifestSettings, JSON_THROW_ON_ERROR)),
                    'status' => 'processing',
                    'media_job_id' => $mediaJob->id,
                    'created_by' => $actor->getKey(),
                ]);
                $mediaJob->forceFill(['options' => array_merge($mediaJob->options ?? [], [
                    'derivativeId' => $derivative->id,
                ])])->save();

                DB::afterCommit(function () use ($mediaJob, $queue): void {
                    $this->progress->notify($mediaJob);
                    ProcessMediaWorkflow::dispatch($mediaJob->id, RequestCorrelation::id())->onQueue($queue);
                });

                return $export;
            });
        } catch (QueryException $exception) {
            $existing = MontageExport::query()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing instanceof MontageExport) {
                return $existing;
            }

            throw $exception;
        }
    }

    /** Runs the same pre-queue checks used by export without creating work. */
    public function assertReady(MontageProject $project, int $expectedRevision, string $preset, User $actor): void
    {
        $project->refresh();
        if ((int) $project->revision !== $expectedRevision) {
            throw new MontageRevisionConflict((int) $project->revision, $expectedRevision);
        }

        $revision = $project->revisions()
            ->where('revision_number', $expectedRevision)
            ->whereKey($project->active_revision_id)
            ->first();
        if ($revision === null) {
            throw new MontageValidationException(['revision' => 'Project has no revision to export.']);
        }

        $manifest = $this->manifests->build($preset, $revision->id, $revision->clips ?? [], $actor);
        $this->qc->assertReady($revision, $manifest);
    }
}
