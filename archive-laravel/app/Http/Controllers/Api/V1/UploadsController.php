<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\UploadContentMismatchException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use App\Services\Uploads\UploadCapacityGuard;
use App\Services\Uploads\UploadFinalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadsController extends Controller
{
    public function __construct(
        private readonly UploadCapacityGuard $capacityGuard,
        private readonly UploadFinalizer $finalizer,
    ) {}

    public function store(StoreUploadRequest $request): JsonResponse
    {
        $disk = (string) config('ingest.disk');
        $directory = trim((string) config('ingest.directory'), '/');
        $folder = trim((string) $request->validated('folder', ''), '/');
        $targetDir = $folder !== '' ? "{$directory}/uploads/{$folder}" : "{$directory}/uploads";
        $quarantineDir = "{$directory}/quarantine";

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $checksum = hash_file('sha256', $file->getRealPath());

        if ($denied = $this->capacityGuard->assertAvailable($disk, (int) $file->getSize())) {
            return $denied;
        }

        // UUID-based storage name — never the client-supplied filename, so
        // path traversal / overwrite via crafted filenames is not possible.
        $storedName = (string) Str::uuid().($extension !== '' ? '.'.$extension : '');

        $storage = Storage::disk($disk);

        // Quarantine tier: land the upload in a non-public, non-served
        // directory first. It is moved into the servable uploads path only
        // after content validation passes; on failure it is deleted, not
        // just rejected with an HTTP error, so nothing invalid lingers on
        // disk (V1-112 — real AV/ClamAV scanning is deferred, see TASKS.md).
        $quarantinePath = $file->storeAs($quarantineDir, $storedName, ['disk' => $disk]);

        try {
            $result = $this->finalizer->finalize($disk, $quarantinePath, $storedName, $fileName, $checksum, $targetDir);
        } catch (UploadContentMismatchException $exception) {
            $storage->delete($quarantinePath);

            return response()->json([
                'ok' => false,
                'error' => $exception->getMessage(),
                'code' => 'unsafe_file_content',
            ], 422);
        }

        return response()->json([
            'ok' => true,
            'record' => $result['record'],
        ], 201);
    }
}
