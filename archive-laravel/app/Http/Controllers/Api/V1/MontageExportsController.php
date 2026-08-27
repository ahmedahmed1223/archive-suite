<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Montage\MontageExportService;
use App\Domain\Montage\MontageRevisionConflict;
use App\Domain\Montage\MontageValidationException;
use App\Http\Controllers\Controller;
use App\Models\MontageExport;
use App\Models\MontageProject;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MontageExportsController extends Controller
{
    public function __construct(
        private readonly MontageExportService $exports,
    ) {}

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
        if ($actor === null || Gate::forUser($actor)->denies('requestExport', $project)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        $data = $request->validate([
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'preset' => ['required', 'string'],
        ]);

        try {
            $export = $this->exports->request(
                $project,
                (int) $data['expectedRevision'],
                (string) $data['preset'],
                $actor,
            );
        } catch (MontageRevisionConflict $e) {
            return response()->json([
                ...ApiError::envelope('Revision conflict.', 409),
                'currentRevision' => $e->currentRevision,
                'expectedRevision' => $e->expectedRevision,
            ], 409);
        } catch (MontageValidationException $e) {
            return response()->json([
                ...ApiError::envelope('Montage validation failed.', 422),
                'errors' => $e->errors,
            ], 422);
        }

        return response()->json($this->present($export), 201);
    }

    /** Check an active revision with the same policy and storage gates as export. */
    public function qc(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $project = MontageProject::query()->find($id);
        if (! $project) {
            return $this->notFound();
        }
        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('requestExport', $project)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }
        $data = $request->validate([
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'preset' => ['required', 'string'],
        ]);

        try {
            $this->exports->assertReady($project, (int) $data['expectedRevision'], (string) $data['preset'], $actor);
        } catch (MontageRevisionConflict $e) {
            return response()->json([
                ...ApiError::envelope('Revision conflict.', 409),
                'currentRevision' => $e->currentRevision,
                'expectedRevision' => $e->expectedRevision,
            ], 409);
        } catch (MontageValidationException $e) {
            return response()->json([
                ...ApiError::envelope('Montage validation failed.', 422),
                'errors' => $e->errors,
            ], 422);
        }

        return response()->json(['ok' => true, 'ready' => true, 'revisionNumber' => (int) $data['expectedRevision']]);
    }

    /** Cancel is allowed for the requester or the project owner. */
    public function cancel(Request $request, string $id, string $exportId): JsonResponse
    {
        $export = MontageExport::with('project')->where('montage_project_id', $id)->find($exportId);
        if (! $export) {
            return $this->notFound();
        }

        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('cancel', $export)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        if (! in_array($export->status, ['queued', 'processing'], true)) {
            return response()->json([
                ...ApiError::envelope('Export is not cancellable.', 422),
                'status' => $export->status,
            ], 422);
        }

        $export->update(['status' => 'cancelled']);

        return response()->json($this->present($export->fresh()));
    }

    /** Retry re-queues a failed export as a new row. */
    public function retry(Request $request, string $id, string $exportId): JsonResponse
    {
        $failed = MontageExport::with('project')->where('montage_project_id', $id)->find($exportId);
        if (! $failed) {
            return $this->notFound();
        }

        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('retry', $failed)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        if ($failed->status !== 'failed') {
            return response()->json([
                ...ApiError::envelope('Export is not retryable.', 422),
                'status' => $failed->status,
            ], 422);
        }

        $retry = MontageExport::create([
            'montage_project_id' => $failed->montage_project_id,
            'montage_project_revision_id' => $failed->montage_project_revision_id,
            'requested_by' => $actor->getKey(),
            'preset' => $failed->preset,
            'status' => 'queued',
            'settings' => $failed->settings,
        ]);

        return response()->json($this->present($retry), 201);
    }

    public function show(Request $request, string $id, string $exportId): JsonResponse
    {
        $export = MontageExport::with('project')->where('montage_project_id', $id)->find($exportId);
        if (! $export) {
            return $this->notFound();
        }

        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('view', $export)) {
            return $this->notFound();
        }

        return response()->json($this->present($export));
    }

    private function notFound(): JsonResponse
    {
        return response()->json(ApiError::envelope('Montage export not found.', 404), 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(?MontageExport $export): array
    {
        return [
            'id' => $export->id,
            'projectId' => $export->montage_project_id,
            'revisionId' => $export->montage_project_revision_id,
            'preset' => $export->preset,
            'status' => $export->status,
            'progress' => (int) $export->progress,
            'checksum' => $export->checksum,
            'error' => $export->error,
            'createdAt' => $export->created_at?->toIso8601String(),
        ];
    }
}
