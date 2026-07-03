<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CollaborationController;
use App\Http\Controllers\Api\V1\FilesController;
use App\Http\Controllers\Api\V1\IngestController;
use App\Http\Controllers\Api\V1\MediaJobsController;
use App\Http\Controllers\Api\V1\RecordsController;
use App\Http\Controllers\Api\V1\ReviewCommentsController;
use App\Http\Controllers\Api\V1\ReviewLinksController;
use App\Http\Controllers\Api\V1\RightsController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\ShareController;
use App\Http\Controllers\Api\V1\SystemController;
use App\Http\Controllers\Api\V1\UploadsController;
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

    Route::get('/share/{token}', [ShareController::class, 'show']);
    Route::get('/review-links/{token}', [ReviewLinksController::class, 'show']);

    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);

    // Media streaming: auth only (no per-range audit spam). Range-capable so the
    // browser can stream/seek local archive media over HTTP instead of file://.
    Route::middleware('archive.auth')->get('/files/stream', [FilesController::class, 'stream']);
    Route::middleware('archive.auth')->get('/collaboration/rooms/{roomKey}/presence', [CollaborationController::class, 'index']);
    Route::middleware('archive.auth')->post('/collaboration/rooms/{roomKey}/presence', [CollaborationController::class, 'heartbeat']);
    Route::middleware('archive.auth')->get('/collaboration/rooms/{roomKey}/locks', [CollaborationController::class, 'locks']);
    Route::middleware('archive.auth')->post('/collaboration/rooms/{roomKey}/locks', [CollaborationController::class, 'acquireLock']);
    Route::middleware('archive.auth')->post('/collaboration/rooms/{roomKey}/locks/release', [CollaborationController::class, 'releaseLock']);
    Route::middleware('archive.auth')->get('/collaboration/rooms/{roomKey}/documents/{resourceId}', [CollaborationController::class, 'document']);
    Route::middleware('archive.auth')->post('/collaboration/rooms/{roomKey}/documents/{resourceId}', [CollaborationController::class, 'updateDocument']);

    Route::middleware(['archive.auth', 'archive.audit'])->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        Route::get('/records', [RecordsController::class, 'index']);
        Route::get('/records/{id}', [RecordsController::class, 'show']);
        Route::post('/records/bulk', [RecordsController::class, 'bulk']);
        Route::get('/search', [SearchController::class, 'index']);
        Route::get('/files', [FilesController::class, 'index']);
        Route::get('/files/browser', [FilesController::class, 'browser']);
        Route::get('/media/jobs', [MediaJobsController::class, 'index']);
        Route::post('/media/jobs', [MediaJobsController::class, 'store']);
        Route::get('/media/jobs/{id}', [MediaJobsController::class, 'show']);
        Route::post('/share', [ShareController::class, 'store']);

        Route::get('/rights/expiring', [RightsController::class, 'expiring']);
        Route::get('/rights/{itemId}/enforcement', [RightsController::class, 'enforcement']);
        Route::get('/rights', [RightsController::class, 'show']);
        Route::post('/rights', [RightsController::class, 'store']);

        Route::post('/uploads', [UploadsController::class, 'store']);

        Route::post('/ingest/scan', [IngestController::class, 'scan']);
        Route::post('/ingest/ftp/pull', [IngestController::class, 'ftpPull']);
        Route::post('/ingest/smb/pull', [IngestController::class, 'smbPull']);

        Route::get('/media/{mediaUid}/review-comments', [ReviewCommentsController::class, 'index']);
        Route::post('/media/{mediaUid}/review-comments', [ReviewCommentsController::class, 'store']);
        Route::post('/media/{mediaUid}/review-links', [ReviewLinksController::class, 'store']);
        Route::patch('/review-comments/{id}', [ReviewCommentsController::class, 'update']);

        Route::get('/system/odbc', [SystemController::class, 'odbc']);
        Route::get('/system/odbc/tables/{table}', [SystemController::class, 'odbcReadTable']);
        Route::post('/system/odbc/tables/{table}/rows', [SystemController::class, 'odbcCreateRow']);
        Route::patch('/system/odbc/tables/{table}/rows', [SystemController::class, 'odbcUpdateRow']);
        Route::delete('/system/odbc/tables/{table}/rows', [SystemController::class, 'odbcDeleteRow']);
        Route::get('/system/security-settings', [SystemController::class, 'getSecuritySettings']);
        Route::patch('/system/security-settings', [SystemController::class, 'updateSecuritySettings']);
    });
});
