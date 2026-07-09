<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Ingest\IngestScanner;
use App\Services\Ingest\IngestTransport;
use App\Services\Notification\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IngestController extends Controller
{
    public function __construct(
        private readonly IngestScanner $scanner,
        private readonly IngestTransport $transport,
        private readonly NotificationService $notificationService
    ) {
    }

    public function scan(): JsonResponse
    {
        $result = $this->scanner->scan();

        return response()->json([
            'ok' => true,
            'ingested' => $result['ingested'],
            'skipped' => $result['skipped'],
        ]);
    }

    public function ftpPull(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'host' => ['required', 'string'],
            'port' => ['sometimes', 'integer', 'min:1', 'max:65535'],
            'user' => ['required', 'string'],
            'password' => ['required', 'string'],
            'remotePath' => ['sometimes', 'string'],
            'localPath' => ['sometimes', 'string'],
            'secure' => ['sometimes', 'boolean'],
        ]);

        // Call transport to pull files
        $pulledFiles = $this->transport->pull($validated);

        // Scan the pulled files
        $localPath = $validated['localPath'] ?? null;
        $result = $this->scanner->scan($localPath ? basename($localPath) : null);

        // Create notification for ingest completion
        if ($request->user() && ($result['ingested'] > 0 || $result['skipped'] > 0)) {
            $this->notificationService->createIngestNotification(
                $request->user(),
                $result['ingested'],
                $result['skipped']
            );
        }

        return response()->json([
            'ok' => true,
            'ingested' => $result['ingested'],
            'skipped' => $result['skipped'],
        ]);
    }

    public function smbPull(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'share' => ['required', 'string'],
            'path' => ['sometimes', 'string'],
            'user' => ['required', 'string'],
            'password' => ['required', 'string'],
            'domain' => ['sometimes', 'string'],
            'localPath' => ['sometimes', 'string'],
        ]);

        // Call transport to pull files
        $pulledFiles = $this->transport->pull($validated);

        // Scan the pulled files
        $localPath = $validated['localPath'] ?? null;
        $result = $this->scanner->scan($localPath ? basename($localPath) : null);

        // Create notification for ingest completion
        if ($request->user() && ($result['ingested'] > 0 || $result['skipped'] > 0)) {
            $this->notificationService->createIngestNotification(
                $request->user(),
                $result['ingested'],
                $result['skipped']
            );
        }

        return response()->json([
            'ok' => true,
            'ingested' => $result['ingested'],
            'skipped' => $result['skipped'],
        ]);
    }
}
