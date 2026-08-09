<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StorageOperation;
use App\Services\Storage\StorageCatalog;
use App\Services\Storage\StorageOperationService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/** Public API for the provider-agnostic file workspace. */
final class StorageWorkspaceController extends Controller
{
    public function index(Request $request, StorageCatalog $catalog): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json(['ok' => true, 'storages' => $catalog->entries()]);
    }

    public function browse(Request $request, string $storage): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $path = (string) ($request->validate(['path' => ['nullable', 'string', 'max:1024']])['path'] ?? '');
        try {
            $disk = Storage::disk($storage);
            $items = collect($disk->listContents($path, false))->map(fn ($item): array => [
                'id' => $item->path(), 'name' => basename($item->path()), 'path' => $item->path(),
                'kind' => $item->isDir() ? 'folder' : 'file', 'size' => $item->isDir() ? null : $item->fileSize(),
                'modifiedAt' => $item->isDir() ? null : ($item->lastModified() ? now()->setTimestamp($item->lastModified())->toIso8601String() : null),
            ])->values()->all();

            return response()->json(['ok' => true, 'path' => $path, 'items' => $items]);
        } catch (\Throwable) {
            return response()->json(ApiError::envelope('Storage location is unavailable.', 404), 404);
        }
    }

    public function preview(Request $request, StorageOperationService $operations): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $data = $request->validate([
            'action' => ['required', 'string'], 'sourceProviderId' => ['required', 'string'], 'destinationProviderId' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1', 'max:1000'], 'items.*.sourcePath' => ['nullable', 'string'], 'items.*.destinationPath' => ['nullable', 'string'],
            'items.*.expectedChecksum' => ['nullable', 'string'], 'items.*.metadata' => ['nullable', 'array'],
        ]);
        try {
            return response()->json(['ok' => true, 'preview' => $operations->preview($data['action'], $data['sourceProviderId'], $data['destinationProviderId'] ?? null, $data['items'])]);
        } catch (RuntimeException $e) {
            return response()->json(ApiError::envelope($e->getMessage(), 422), 422);
        }
    }

    public function start(Request $request, StorageOperationService $operations): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $data = $request->validate(['previewToken' => ['required', 'string'], 'idempotencyKey' => ['required', 'string', 'max:255']]);
        try {
            return response()->json(['ok' => true, 'operation' => $this->operation($operations->start($data['previewToken'], $data['idempotencyKey'], $request->user()?->id))], 201);
        } catch (RuntimeException $e) {
            return response()->json(ApiError::envelope($e->getMessage(), 422), 422);
        }
    }

    public function show(Request $request, StorageOperation $operation): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json(['ok' => true, 'operation' => $this->operation($operation->load('items'))]);
    }

    public function cancel(Request $request, StorageOperation $operation, StorageOperationService $operations): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json(['ok' => true, 'operation' => $this->operation($operations->cancel($operation))]);
    }

    /** @return array<string,mixed> */
    private function operation(StorageOperation $operation): array
    {
        return ['id' => $operation->id, 'action' => $operation->action, 'status' => $operation->status, 'sourceProviderId' => $operation->source_provider_id, 'destinationProviderId' => $operation->destination_provider_id, 'resumeState' => $operation->resume_state, 'items' => $operation->items->map(fn ($item) => ['id' => $item->id, 'sourcePath' => $item->source_path, 'destinationPath' => $item->destination_path, 'status' => $item->status, 'errorCode' => $item->error_code])->values()];
    }
}
