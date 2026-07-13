<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

abstract class Controller
{
    /**
     * Return a 403 response unless the authenticated archive user is an admin.
     */
    protected function requireAdmin(Request $request): ?JsonResponse
    {
        return $this->requireAbility($request, 'manage-system');
    }

    /**
     * Return a 403 response unless the authenticated archive user is an editor
     * or admin. Viewer is the default, read-only role (V1-102).
     */
    protected function requireEditor(Request $request): ?JsonResponse
    {
        return $this->requireAbility($request, 'manage-content');
    }

    private function requireAbility(Request $request, string $ability): ?JsonResponse
    {
        $user = $request->attributes->get('archive_user');

        if (! $user instanceof User || Gate::forUser($user)->denies($ability)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        return null;
    }
}
