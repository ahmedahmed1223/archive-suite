<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * Return a 403 response unless the authenticated archive user is an admin.
     */
    protected function requireAdmin(Request $request): ?JsonResponse
    {
        $user = $request->attributes->get('archive_user');

        if (! $user instanceof User || $user->role !== 'admin') {
            return response()->json(['ok' => false, 'error' => 'Forbidden.'], 403);
        }

        return null;
    }
}
