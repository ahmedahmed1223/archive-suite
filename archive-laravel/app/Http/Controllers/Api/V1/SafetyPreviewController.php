<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SafetyPreview\SafetyPreviewService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SafetyPreviewController extends Controller
{
    public function scenarios(Request $request, SafetyPreviewService $service): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        return response()->json(['ok' => true, 'synthetic' => true, 'scenarios' => $service->scenarios()]);
    }

    public function run(Request $request, SafetyPreviewService $service): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        try {
            $validated = $request->validate([
                'scenario' => ['required', 'string', Rule::in($service->scenarioIds())],
                'operation' => ['required', 'string', Rule::in(['delete', 'restore'])],
                'ids' => ['required', 'array', 'min:1', 'max:10000'],
                'ids.*' => ['required', 'string', 'min:1'],
            ]);
        } catch (ValidationException $exception) {
            // Framework validation escapes the route middleware pipeline; keep
            // the global ApiError shape and append only this endpoint's marker.
            $response = ApiError::renderException($exception, $request);
            $payload = $response->getData(true);
            $payload['synthetic'] = true;

            return $response->setData($payload);
        }

        return response()->json(['ok' => true, ...$service->run($validated['scenario'], $validated['operation'], $validated['ids'])]);
    }
}
