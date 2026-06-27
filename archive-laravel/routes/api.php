<?php

use App\Http\Controllers\Api\V1\RightsController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function (): JsonResponse {
        return response()->json([
            'ok' => true,
            'backend' => 'laravel',
            'engine' => config('database.default'),
            'uptimeSec' => 0,
            'version' => config('app.version', '0.1.0'),
            'authRequired' => true,
        ]);
    });

    Route::get('/public/openapi.json', function (): JsonResponse {
        $contractPath = base_path('../docs/api/archive-contract.openapi.json');

        if (! is_file($contractPath)) {
            return response()->json([
                'ok' => false,
                'error' => 'API contract file is missing.',
            ], 500);
        }

        return response()->json(json_decode((string) file_get_contents($contractPath), true));
    });

    Route::middleware('archive.api_key')->group(function (): void {
        Route::get('/rights/expiring', [RightsController::class, 'expiring']);
        Route::get('/rights/{itemId}/enforcement', [RightsController::class, 'enforcement']);
        Route::get('/rights', [RightsController::class, 'show']);
        Route::post('/rights', [RightsController::class, 'store']);
    });
});
