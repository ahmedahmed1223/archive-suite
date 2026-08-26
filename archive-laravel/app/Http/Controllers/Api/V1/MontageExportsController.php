<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Montage\MontageExportService;
use App\Domain\Montage\MontageRevisionConflict;
use App\Http\Controllers\Controller;
use App\Models\MontageExport;
use App\Models\MontageProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MontageExportsController extends Controller
{
    public function __construct(
        private readonly MontageExportService $exports,
    ) {
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'preset' => ['required', 'string'],
        ]);

        $project = MontageProject::findOrFail($id);

        try {
            $export = $this->exports->request(
                $project,
                (int) $data['expectedRevision'],
                (string) $data['preset'],
                $request->user(),
            );
        } catch (MontageRevisionConflict $e) {
            return response()->json([
                'error' => 'revision_conflict',
                'currentRevision' => $e->currentRevision,
            ], 409);
        }

        return response()->json($this->present($export), 201);
    }

    /** Cancel is allowed for the requester or the project owner. */
    public function cancel(Request $request, string $id, string $exportId): JsonResponse
    {
        $export = MontageExport::where('montage_project_id', $id)->findOrFail($exportId);

        if ($export->requested_by !== $request->user()->id && ! $request->user()->is_admin) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        if (! in_array($export->status, ['queued', 'processing'], true)) {
            return response()->json(['error' => 'not_cancellable', 'status' => $export->status], 422);
        }

        $export->update(['status' => 'cancelled']);

        return response()->json($this->present($export->fresh()));
    }

    /** Retry re-queues a failed export as a new row. */
    public function retry(Request $request, string $id, string $exportId): JsonResponse
    {
        $failed = MontageExport::where('montage_project_id', $id)->findOrFail($exportId);

        if ($failed->requested_by !== $request->user()->id && ! $request->user()->is_admin) {
            return response()->json(['error' => 'forbidden'], 403);
        }

        if ($failed->status !== 'failed') {
            return response()->json(['error' => 'not_retryable', 'status' => $failed->status], 422);
        }

        $retry = MontageExport::create([
            'montage_project_id' => $failed->montage_project_id,
            'montage_project_revision_id' => $failed->montage_project_revision_id,
            'requested_by' => $request->user()->id,
            'preset' => $failed->preset,
            'status' => 'queued',
            'settings' => $failed->settings,
        ]);

        return response()->json($this->present($retry), 201);
    }

    public function show(string $id, string $exportId): JsonResponse
    {
        $export = MontageExport::where('montage_project_id', $id)->findOrFail($exportId);

        return response()->json($this->present($export));
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
