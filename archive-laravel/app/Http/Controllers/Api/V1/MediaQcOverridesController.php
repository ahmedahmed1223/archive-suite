<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MediaInspection;
use App\Models\User;
use App\Services\Media\MediaApprovalService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class MediaQcOverridesController extends Controller
{
    public function __construct(private readonly MediaApprovalService $approvals) {}

    public function store(Request $request, string $inspectionId): JsonResponse
    {
        $inspection = MediaInspection::query()->find($inspectionId);
        if (! $inspection instanceof MediaInspection) return response()->json(ApiError::envelope('QC inspection not found.', 404), 404);
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);
        $actor = $request->attributes->get('archive_user');
        if (! $actor instanceof User) return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        try { $override = $this->approvals->override($inspection, $actor, $validated['reason']); }
        catch (RuntimeException $error) {
            $status = $error->getMessage() === 'forbidden' ? 403 : 422;
            return response()->json(ApiError::envelope($error->getMessage(), $status), $status);
        }
        return response()->json(['ok' => true, 'override' => ['id' => $override->id, 'inspectionId' => $override->media_inspection_id, 'reason' => $override->reason, 'overriddenAt' => $override->overridden_at?->toISOString()]], 201);
    }
}
