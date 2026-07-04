<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Backup\BackupException;
use App\Services\Backup\BackupService;
use App\Services\Backup\DrReadinessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BackupsController extends Controller
{
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
            return response()->json(['ok' => true, 'backup' => $service->run()], 201);
        } catch (BackupException $e) {
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

            return response()->json(['ok' => true, 'result' => $result]);
        } catch (BackupException $e) {
            return $this->backupError($e);
        }
    }

    private function backupError(BackupException $e): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => $e->getMessage()], $e->status);
    }
}
