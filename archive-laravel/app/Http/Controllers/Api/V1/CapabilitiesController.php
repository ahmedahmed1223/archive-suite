<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateCapabilitiesRequest;
use App\Models\User;
use App\Services\Settings\CapabilitySettingsService;
use App\Services\Settings\CapabilityVersionConflictException;
use App\Services\Settings\LockedSettingException;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CapabilitiesController extends Controller
{
    public function index(Request $request, CapabilitySettingsService $settings): JsonResponse
    {
        $user = $request->attributes->get('archive_user');

        return response()->json([
            'ok' => true,
            'schemaVersion' => (int) config('archive-settings.schema_version'),
            'capabilities' => $settings->capabilities($user instanceof User ? $user : null),
        ]);
    }

    public function update(UpdateCapabilitiesRequest $request, CapabilitySettingsService $settings): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        /** @var User $user */
        $user = $request->attributes->get('archive_user');

        try {
            $settings->update($request->values(), $user, $request->expectedVersions());
        } catch (LockedSettingException $exception) {
            return response()->json([
                ...ApiError::envelope($exception->getMessage(), 403, 'SETTING_LOCKED'),
                'source' => $exception->source,
            ], 403);
        } catch (CapabilityVersionConflictException $exception) {
            return response()->json([
                ...ApiError::envelope($exception->getMessage(), 409, 'CAPABILITY_VERSION_CONFLICT'),
                'capabilities' => $settings->capabilities($user),
            ], 409);
        }

        return response()->json([
            'ok' => true,
            'schemaVersion' => (int) config('archive-settings.schema_version'),
            'capabilities' => $settings->capabilities($user),
        ]);
    }
}
