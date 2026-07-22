<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SafetyPreview\SafetyPreviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SafetyPreviewController extends Controller
{
    public function scenarios(Request $request, SafetyPreviewService $service): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        return response()->json(['synthetic' => true, 'scenarios' => $service->scenarios()]);
    }

    public function run(Request $request, SafetyPreviewService $service): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'scenario' => ['required', 'string', Rule::in($service->scenarios())],
            'operation' => ['required', 'string', Rule::in(['delete', 'restore'])],
            'ids' => ['required', 'array', 'min:1', 'max:10000'],
            'ids.*' => ['required', 'string', 'min:1'],
        ]);

        return response()->json($service->run($validated['scenario'], $validated['operation'], $validated['ids']));
    }
}
