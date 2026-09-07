<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MediaInspection;
use App\Services\Media\MediaInspectionService;
use App\Services\Media\MediaApprovalService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class MediaInspectionsController extends Controller
{
    public function __construct(private readonly MediaInspectionService $inspections, private readonly MediaApprovalService $approvals) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: null;
        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->inspections->assertRecordExists($recordId, $store);
        } catch (RuntimeException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 404), 404);
        }

        $inspections = MediaInspection::query()->where('record_store', $recordStore)->where('record_uid', $recordUid)->orderByDesc('completed_at')->get()
            ->map(fn (MediaInspection $inspection): array => $this->payload($inspection))->values();

        return response()->json(['ok' => true, 'inspections' => $inspections]);
    }

    /** @return array<string, mixed> */
    private function payload(MediaInspection $inspection): array
    {
        return [
            'id' => $inspection->id,
            'recordStore' => $inspection->record_store,
            'recordUid' => $inspection->record_uid,
            'inspectionType' => $inspection->inspection_type,
            'status' => $inspection->status,
            'versionToken' => $inspection->version_token,
            'isCurrentVersion' => $this->inspections->isCurrentVersion($inspection),
            'report' => $inspection->report,
            'mediaJobId' => $inspection->media_job_id,
            'completedAt' => $inspection->completed_at?->toISOString(),
            'qcOverride' => $inspection->inspection_type === 'qc' && $this->approvals->isOverridden($inspection),
        ];
    }
}
