<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\MaterialStages\MaterialStagesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaterialStagesController extends Controller
{
    public function __construct(private readonly MaterialStagesService $stagesService) {}

    public function inbox(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store' => ['required', 'string'],
            'stage' => ['nullable', 'string'],
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);
        $result = $this->stagesService->getStageGrouped(
            store: $validated['store'],
            filterStage: $validated['stage'] ?? null,
            cursor: $validated['cursor'] ?? null,
            limit: $limit
        );

        return response()->json($result);
    }
}
