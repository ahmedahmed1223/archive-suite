<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateExperienceRequest;
use App\Models\User;
use App\Services\Settings\ExperienceProfileService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExperienceController extends Controller
{
    public function show(Request $request, ExperienceProfileService $profiles): JsonResponse
    {
        $user = $this->user($request);

        if (! $user) {
            return response()->json(ApiError::envelope('Unauthorized.', 401), 401);
        }

        return $this->response($profiles, $user);
    }

    public function update(UpdateExperienceRequest $request, ExperienceProfileService $profiles): JsonResponse
    {
        $user = $this->user($request);

        if (! $user) {
            return response()->json(ApiError::envelope('Unauthorized.', 401), 401);
        }

        $profiles->update($user, $request->validated());

        return $this->response($profiles, $user->refresh());
    }

    public function destroy(Request $request, ExperienceProfileService $profiles): JsonResponse
    {
        $user = $this->user($request);

        if (! $user) {
            return response()->json(ApiError::envelope('Unauthorized.', 401), 401);
        }

        $profiles->reset($user);

        return $this->response($profiles, $user->refresh());
    }

    private function user(Request $request): ?User
    {
        $user = $request->attributes->get('archive_user');

        return $user instanceof User ? $user : null;
    }

    private function response(ExperienceProfileService $profiles, User $user): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'schemaVersion' => (int) config('archive-settings.schema_version'),
            ...$profiles->profile($user),
        ]);
    }
}
