<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Dropbox\DropboxConnectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DropboxController extends Controller
{
    public function show(Request $request, DropboxConnectionService $dropbox): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        return response()->json(['ok' => true, 'dropbox' => $dropbox->status($request->user())]);
    }
    public function connect(Request $request, DropboxConnectionService $dropbox): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        $data = $request->validate(['accessToken' => ['required', 'string', 'max:4096'], 'refreshToken' => ['nullable', 'string', 'max:4096'], 'folderPath' => ['nullable', 'string', 'max:1024'], 'expiresAt' => ['nullable', 'date']]);
        try {
            return response()->json(['ok' => true, 'dropbox' => $dropbox->connect($request->user(), $data['accessToken'], $data['refreshToken'] ?? null, $data['folderPath'] ?? '/', $data['expiresAt'] ?? null)], 201);
        } catch (\LogicException $e) { return response()->json(['ok' => false, 'error' => $e->getMessage()], 409); }
    }
    public function disconnect(Request $request, DropboxConnectionService $dropbox): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        return response()->json(['ok' => true, 'dropbox' => $dropbox->disconnect($request->user())]);
    }
}
