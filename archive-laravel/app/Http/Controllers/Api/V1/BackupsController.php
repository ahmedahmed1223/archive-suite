<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Backup\BackupException;
use App\Services\Backup\BackupService;
use App\Services\Backup\DrReadinessService;
use App\Services\Notification\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BackupsController extends Controller
{
    public function __construct(
        private readonly NotificationService $notificationService
    ) {
    }

    public function index(Request $request, BackupService $service): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json(['ok' => true, 'backups' => $service->list()]);
    }

    public function run(Request $request, BackupService $service): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        try {
            $backup = $service->run();
            // Create success notification
            if ($request->user()) {
                $this->notificationService->createBackupNotification(
                    $request->user(),
                    true,
                    $backup['name'] ?? null
                );
            }
            return response()->json(['ok' => true, 'backup' => $backup], 201);
        } catch (BackupException $e) {
            // Create failure notification
            if ($request->user()) {
                $this->notificationService->createBackupNotification(
                    $request->user(),
                    false,
                    null,
                    $e->getMessage()
                );
            }
            return $this->backupError($e);
        }
    }

    public function preview(Request $request, BackupService $service): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        try {
            return response()->json(['ok' => true, 'preview' => $service->preview($validated['name'])]);
        } catch (BackupException $e) {
            return $this->backupError($e);
        }
    }

    public function restore(Request $request, BackupService $service, DrReadinessService $dr): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        try {
            $result = $service->restore($validated['name']);
            $dr->recordRestoreTest(true);

            // Create success notification
            if ($request->user()) {
                $this->notificationService->createRestoreNotification(
                    $request->user(),
                    true,
                    $validated['name']
                );
            }

            return response()->json(['ok' => true, 'result' => $result]);
        } catch (BackupException $e) {
            // Create failure notification
            if ($request->user()) {
                $this->notificationService->createRestoreNotification(
                    $request->user(),
                    false,
                    $validated['name'],
                    $e->getMessage()
                );
            }
            return $this->backupError($e);
        }
    }

    public function verify(Request $request, BackupService $service): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        try {
            return response()->json(['ok' => true, 'verification' => $service->verify($validated['name'])]);
        } catch (BackupException $e) {
            return $this->backupError($e);
        }
    }

    public function drDrill(Request $request, BackupService $service, DrReadinessService $dr): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        try {
            $result = $dr->runDrDrill($service);

            return response()->json(['ok' => true, 'result' => $result]);
        } catch (BackupException $e) {
            return $this->backupError($e);
        }
    }

    public function drStatus(Request $request, DrReadinessService $dr): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json(['ok' => true, 'status' => $dr->drillStatus()]);
    }

    private function backupError(BackupException $e): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => $e->getMessage()], $e->status);
    }
}
