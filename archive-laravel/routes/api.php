<?php

use App\Http\Controllers\Api\V1\AccountExportController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BackupsController;
use App\Http\Controllers\Api\V1\CollaborationController;
use App\Http\Controllers\Api\V1\DiscoverController;
use App\Http\Controllers\Api\V1\FilesController;
use App\Http\Controllers\Api\V1\ImportPreviewController;
use App\Http\Controllers\Api\V1\IngestController;
use App\Http\Controllers\Api\V1\IntakeTemplatesController;
use App\Http\Controllers\Api\V1\InvitationsController;
use App\Http\Controllers\Api\V1\MediaJobsController;
use App\Http\Controllers\Api\V1\RecordCommentsController;
use App\Http\Controllers\Api\V1\RecordHistoryController;
use App\Http\Controllers\Api\V1\RecordsController;
use App\Http\Controllers\Api\V1\RecordNotesController;
use App\Http\Controllers\Api\V1\RelationsController;
use App\Http\Controllers\Api\V1\ReviewCommentsController;
use App\Http\Controllers\Api\V1\ReviewLinksController;
use App\Http\Controllers\Api\V1\RightsController;
use App\Http\Controllers\Api\V1\SavedSearchesController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\ShareController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\SystemControlController;
use App\Http\Controllers\Api\V1\SystemController;
use App\Http\Controllers\Api\V1\SystemStatusController;
use App\Http\Controllers\Api\V1\UploadLinksController;
use App\Http\Controllers\Api\V1\UploadsController;
use App\Http\Controllers\Api\V1\UsersController;
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
    Route::post('/invitations/{token}/accept', [InvitationsController::class, 'accept']);
    // Public validation for external upload-link recipients (no archive session).
    Route::get('/upload-links/{token}', [UploadLinksController::class, 'show']);

    // Brute-force guard: contract documents the 429 response on login.
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
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
        Route::get('/records/{id}/notes', [RecordNotesController::class, 'index']);
        Route::post('/records/{id}/notes', [RecordNotesController::class, 'store']);
        Route::get('/records/{id}/comments', [RecordCommentsController::class, 'index']);
        Route::post('/records/{id}/comments', [RecordCommentsController::class, 'store']);
        Route::get('/records/{id}/history', [RecordHistoryController::class, 'index']);
        Route::post('/records/bulk', [RecordsController::class, 'bulk']);
        Route::post('/records/bulk-delete', [RecordsController::class, 'bulkDelete']);
        Route::patch('/record-notes/{id}', [RecordNotesController::class, 'update']);
        Route::delete('/record-notes/{id}', [RecordNotesController::class, 'destroy']);
        Route::delete('/record-comments/{id}', [RecordCommentsController::class, 'destroy']);
        Route::get('/sync', [SyncController::class, 'index']);
        Route::get('/search', [SearchController::class, 'index']);
        Route::get('/discover', [DiscoverController::class, 'index']);
        Route::get('/relations/graph', [RelationsController::class, 'graph']);
        Route::post('/relations', [RelationsController::class, 'store']);
        Route::delete('/relations/{id}', [RelationsController::class, 'destroy']);
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

        Route::get('/intake-templates', [IntakeTemplatesController::class, 'index']);
        Route::post('/intake-templates', [IntakeTemplatesController::class, 'store']);
        Route::delete('/intake-templates/{id}', [IntakeTemplatesController::class, 'destroy']);

        Route::post('/import/preview', [ImportPreviewController::class, 'preview']);

        Route::get('/upload-links', [UploadLinksController::class, 'index']);
        Route::post('/upload-links', [UploadLinksController::class, 'store']);
        Route::post('/upload-links/{id}/revoke', [UploadLinksController::class, 'revoke']);

        Route::get('/saved-searches', [SavedSearchesController::class, 'index']);
        Route::post('/saved-searches', [SavedSearchesController::class, 'store']);
        Route::delete('/saved-searches/{id}', [SavedSearchesController::class, 'destroy']);

        Route::get('/users', [UsersController::class, 'index']);
        Route::post('/users', [UsersController::class, 'store']);
        Route::patch('/users/{id}', [UsersController::class, 'update']);
        Route::delete('/users/{id}', [UsersController::class, 'destroy']);

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

        Route::get('/system/backups', [BackupsController::class, 'index']);
        Route::post('/system/backups/run', [BackupsController::class, 'run']);
        Route::post('/system/backups/preview', [BackupsController::class, 'preview']);
        Route::post('/system/backups/restore', [BackupsController::class, 'restore']);

        Route::get('/system/status', [SystemStatusController::class, 'status']);
        Route::get('/system/dr-probe', [SystemStatusController::class, 'drProbe']);
        Route::post('/system/control/{action}', [SystemControlController::class, 'run']);

        Route::get('/account/export', [AccountExportController::class, 'export']);
    });
});
