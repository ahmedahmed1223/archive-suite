<?php

use App\Http\Controllers\Api\V1\AccountExportController;
use App\Http\Controllers\Api\V1\ActivityController;
use App\Http\Controllers\Api\V1\AutomationRulesController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BackupsController;
use App\Http\Controllers\Api\V1\CollaborationController;
use App\Http\Controllers\Api\V1\ComplianceReportsController;
use App\Http\Controllers\Api\V1\CollectionsController;
use App\Http\Controllers\Api\V1\DiscoverController;
use App\Http\Controllers\Api\V1\FilesController;
use App\Http\Controllers\Api\V1\ImportPreviewController;
use App\Http\Controllers\Api\V1\InboxController;
use App\Http\Controllers\Api\V1\IngestController;
use App\Http\Controllers\Api\V1\IntakeTemplatesController;
use App\Http\Controllers\Api\V1\InvitationsController;
use App\Http\Controllers\Api\V1\MediaJobsController;
use App\Http\Controllers\Api\V1\MontageProjectsController;
use App\Http\Controllers\Api\V1\NotificationsController;
use App\Http\Controllers\Api\V1\PluginMarketplaceController;
use App\Http\Controllers\Api\V1\PublicCatalogController;
use App\Http\Controllers\Api\V1\RecordCommentsController;
use App\Http\Controllers\Api\V1\RecordHistoryController;
use App\Http\Controllers\Api\V1\RecordsController;
use App\Http\Controllers\Api\V1\RecordBroadcastMetadataController;
use App\Http\Controllers\Api\V1\RecordNotesController;
use App\Http\Controllers\Api\V1\RelationsController;
use App\Http\Controllers\Api\V1\ReviewCommentsController;
use App\Http\Controllers\Api\V1\ReviewLinksController;
use App\Http\Controllers\Api\V1\RightsController;
use App\Http\Controllers\Api\V1\SavedSearchesController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\SuggestionsController;
use App\Http\Controllers\Api\V1\ShareController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\TagNodesController;
use App\Http\Controllers\Api\V1\SystemControlController;
use App\Http\Controllers\Api\V1\SystemController;
use App\Http\Controllers\Api\V1\SystemStatusController;
use App\Http\Controllers\Api\V1\TypesController;
use App\Http\Controllers\Api\V1\UploadLinksController;
use App\Http\Controllers\Api\V1\UploadsController;
use App\Http\Controllers\Api\V1\UsersController;
use App\Http\Controllers\Api\V1\VocabularyController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function (): JsonResponse {
        // Keep uptime independent of Redis so an unavailable cache can still be
        // reported as a structured 503 instead of aborting the health request.
        $bootedAt = defined('LARAVEL_START') ? (float) LARAVEL_START : microtime(true);

        // V1-202: deep health for compose healthchecks (laravel-fpm has no
        // other fast way to know redis/storage are actually reachable, not
        // just that PHP booted). Each check is wrapped so one failure
        // doesn't take the others down with it; total cost is a handful of
        // in-process/local-disk round trips, well under the 1s budget.
        $checks = ['db' => false, 'redis' => false, 'storage' => false];

        try {
            DB::select('select 1');
            $checks['db'] = true;
        } catch (\Throwable) {
            // left false
        }

        try {
            $key = 'archive:health:check';
            Cache::put($key, '1', 5);
            $checks['redis'] = Cache::get($key) === '1';
        } catch (\Throwable) {
            // left false
        }

        try {
            $file = 'health-check-'.getmypid().'.tmp';
            Storage::disk('local')->put($file, 'ok');
            $checks['storage'] = Storage::disk('local')->get($file) === 'ok';
            Storage::disk('local')->delete($file);
        } catch (\Throwable) {
            // left false
        }

        $ok = ! in_array(false, $checks, true);

        return response()->json([
            'ok' => $ok,
            'backend' => 'laravel',
            'engine' => config('database.default'),
            'uptimeSec' => max(0, (int) floor(microtime(true) - $bootedAt)),
            'version' => config('app.version', '0.1.0'),
            'authRequired' => true,
            'checks' => $checks,
        ], $ok ? 200 : 503);
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

    Route::get('/public/catalog', [PublicCatalogController::class, 'index']);
    // Public token endpoints: throttle to blunt token-guessing brute force.
    Route::get('/share/{token}', [ShareController::class, 'show'])->middleware('throttle:30,1');
    Route::get('/review-links/{token}', [ReviewLinksController::class, 'show'])->middleware('throttle:30,1');
    Route::post('/invitations/{token}/accept', [InvitationsController::class, 'accept'])->middleware('throttle:30,1');
    // Public validation for external upload-link recipients (no archive session).
    Route::get('/upload-links/{token}', [UploadLinksController::class, 'show'])->middleware('throttle:30,1');

    // Brute-force guard: contract documents the 429 response on login.
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    // Refresh-token replay/abuse guard — same 429 class as login.
    Route::post('/auth/refresh', [AuthController::class, 'refresh'])->middleware('throttle:30,1');

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
        // V1-001: niche broadcast (MOS/MXF) integration — experimental, flagged.
        Route::middleware('archive.feature:broadcast_metadata')->group(function (): void {
            Route::get('/records/{id}/broadcast-metadata', [RecordBroadcastMetadataController::class, 'show']);
            Route::put('/records/{id}/broadcast-metadata', [RecordBroadcastMetadataController::class, 'update']);
        });
        Route::post('/records/bulk', [RecordsController::class, 'bulk']);
        Route::post('/records/bulk-delete', [RecordsController::class, 'bulkDelete']);
        Route::patch('/record-notes/{id}', [RecordNotesController::class, 'update']);
        Route::delete('/record-notes/{id}', [RecordNotesController::class, 'destroy']);
        Route::delete('/record-comments/{id}', [RecordCommentsController::class, 'destroy']);
        Route::get('/sync', [SyncController::class, 'index']);
        Route::get('/activity', [ActivityController::class, 'index']);
        Route::get('/reports/compliance', [ComplianceReportsController::class, 'index']);
        Route::get('/reports/compliance/export', [ComplianceReportsController::class, 'export']);
        Route::get('/plugins', [PluginMarketplaceController::class, 'index']);
        Route::get('/search', [SearchController::class, 'index']);
        Route::get('/discover', [DiscoverController::class, 'index']);
        Route::get('/suggestions', [SuggestionsController::class, 'index']);
        Route::put('/suggestions/{key}/feedback', [SuggestionsController::class, 'feedback']);
        Route::get('/relations/graph', [RelationsController::class, 'graph']);
        Route::post('/relations', [RelationsController::class, 'store']);
        Route::patch('/relations/{id}', [RelationsController::class, 'update']);
        Route::delete('/relations/{id}', [RelationsController::class, 'destroy']);
        Route::get('/files', [FilesController::class, 'index']);
        Route::get('/files/browser', [FilesController::class, 'browser']);
        Route::get('/media/jobs', [MediaJobsController::class, 'index']);
        Route::post('/media/jobs', [MediaJobsController::class, 'store']);
        Route::get('/media/jobs/{id}', [MediaJobsController::class, 'show']);
        Route::post('/media/jobs/{id}/cancel', [MediaJobsController::class, 'cancel']);

        Route::get('/montage-projects', [MontageProjectsController::class, 'index']);
        Route::post('/montage-projects', [MontageProjectsController::class, 'store']);
        Route::get('/montage-projects/{id}', [MontageProjectsController::class, 'show']);
        Route::put('/montage-projects/{id}', [MontageProjectsController::class, 'update']);
        Route::delete('/montage-projects/{id}', [MontageProjectsController::class, 'destroy']);

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

        Route::get('/collections', [CollectionsController::class, 'index']);
        Route::post('/collections', [CollectionsController::class, 'store']);
        Route::delete('/collections/{id}', [CollectionsController::class, 'destroy']);

        Route::get('/inbox', [InboxController::class, 'index']);
        Route::post('/inbox', [InboxController::class, 'store']);
        Route::patch('/inbox/{id}', [InboxController::class, 'update']);
        Route::delete('/inbox/{id}', [InboxController::class, 'destroy']);

        Route::get('/vocabulary', [VocabularyController::class, 'index']);
        Route::post('/vocabulary', [VocabularyController::class, 'store']);
        Route::delete('/vocabulary/{id}', [VocabularyController::class, 'destroy']);

        Route::get('/tag-nodes', [TagNodesController::class, 'index']);
        Route::post('/tag-nodes', [TagNodesController::class, 'store']);
        Route::patch('/tag-nodes/{id}', [TagNodesController::class, 'update']);
        Route::delete('/tag-nodes/{id}', [TagNodesController::class, 'destroy']);
        Route::post('/tag-nodes/reorder', [TagNodesController::class, 'reorder']);
        Route::post('/tag-nodes/{id}/merge', [TagNodesController::class, 'merge']);
        Route::post('/tag-nodes/{id}/move', [TagNodesController::class, 'move']);

        Route::get('/types', [TypesController::class, 'index']);
        Route::post('/types', [TypesController::class, 'store']);
        Route::get('/types/{id}', [TypesController::class, 'show']);
        Route::delete('/types/{id}', [TypesController::class, 'destroy']);
        Route::post('/types/{id}/check-field-acl', [TypesController::class, 'checkFieldAcl']);

        Route::get('/automation/rules', [AutomationRulesController::class, 'index']);
        Route::post('/automation/rules', [AutomationRulesController::class, 'store']);
        Route::patch('/automation/rules/{id}', [AutomationRulesController::class, 'update']);
        Route::delete('/automation/rules/{id}', [AutomationRulesController::class, 'destroy']);
        Route::post('/automation/rules/{id}/run', [AutomationRulesController::class, 'run']);

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

        // V1-001: generic external-database (ODBC) proxy — experimental, flagged.
        Route::middleware('archive.feature:odbc')->group(function (): void {
            Route::get('/system/odbc', [SystemController::class, 'odbc']);
            Route::get('/system/odbc/tables/{table}', [SystemController::class, 'odbcReadTable']);
            Route::post('/system/odbc/tables/{table}/rows', [SystemController::class, 'odbcCreateRow']);
            Route::patch('/system/odbc/tables/{table}/rows', [SystemController::class, 'odbcUpdateRow']);
            Route::delete('/system/odbc/tables/{table}/rows', [SystemController::class, 'odbcDeleteRow']);
        });
        Route::get('/system/security-settings', [SystemController::class, 'getSecuritySettings']);
        Route::patch('/system/security-settings', [SystemController::class, 'updateSecuritySettings']);
        Route::post('/system/test-storage', [SystemController::class, 'testStorageConnection']);
        Route::post('/system/test-database', [SystemController::class, 'testDatabaseConnection']);

        Route::get('/system/backups', [BackupsController::class, 'index']);
        Route::post('/system/backups/run', [BackupsController::class, 'run']);
        Route::post('/system/backups/preview', [BackupsController::class, 'preview']);
        Route::post('/system/backups/restore', [BackupsController::class, 'restore']);
        Route::post('/system/backups/verify', [BackupsController::class, 'verify']);
        Route::post('/system/backups/dr-drill', [BackupsController::class, 'drDrill']);
        Route::get('/system/backups/dr-status', [BackupsController::class, 'drStatus']);

        Route::get('/system/status', [SystemStatusController::class, 'status']);
        Route::get('/system/dr-probe', [SystemStatusController::class, 'drProbe']);
        Route::post('/system/control/{action}', [SystemControlController::class, 'run']);

        Route::get('/account/export', [AccountExportController::class, 'export']);

        Route::get('/notifications', [NotificationsController::class, 'index']);
        Route::get('/notifications/{id}', [NotificationsController::class, 'show']);
        Route::post('/notifications/{id}/read', [NotificationsController::class, 'markRead']);
        Route::post('/notifications/{id}/unread', [NotificationsController::class, 'markUnread']);
        Route::post('/notifications/mark-all-read', [NotificationsController::class, 'markAllRead']);
        Route::delete('/notifications/{id}', [NotificationsController::class, 'destroy']);
    });
});
