<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Onboarding\OnboardingProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OnboardingProgressController extends Controller
{
    public function index(OnboardingProgressService $progress): JsonResponse
    {
        return response()->json(['ok' => true, 'progress' => $progress->progress()]);
    }

    public function update(Request $request, string $stage, OnboardingProgressService $progress): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['pending', 'completed'])],
        ]);

        return response()->json([
            'ok' => true,
            'progress' => $progress->update($stage, $validated['status']),
        ]);
    }
}
