<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Account\AccountExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountExportController extends Controller
{
    public function export(Request $request, AccountExportService $service): JsonResponse
    {
        $user = $request->attributes->get('archive_user');

        if (! $user instanceof User) {
            return response()->json(['ok' => false, 'error' => 'Unauthenticated.'], 401);
        }

        return response()->json([
            'ok' => true,
            'export' => $service->exportFor($user),
        ]);
    }
}
