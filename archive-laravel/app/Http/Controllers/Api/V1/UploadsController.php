<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use App\Jobs\ProcessMediaWorkflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadsController extends Controller
{
    public function store(StoreUploadRequest $request): JsonResponse
    {
        $disk = (string) config('ingest.disk');
        $directory = trim((string) config('ingest.directory'), '/');
        $folder = trim((string) $request->validated('folder', ''), '/');
        $targetDir = $folder !== '' ? "{$directory}/uploads/{$folder}" : "{$directory}/uploads";

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $storedPath = $file->storeAs($targetDir, $fileName, ['disk' => $disk]);

        $checksum = hash_file('sha256', $file->getRealPath());
        $recordId = (string) Str::uuid();
        $now = now();

        $recordData = [
            'id' => $recordId,
            'uid' => $recordId,
            'title' => $fileName,
            'fileName' => $fileName,
            'filePath' => $storedPath,
            'checksum' => $checksum,
            'source' => 'upload',
            'createdAt' => $now->toIso8601String(),
            'updatedAt' => $now->toIso8601String(),
        ];

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $recordId,
            'data' => json_encode($recordData, JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($this->isMediaFile($fileName)) {
            $this->enqueueMediaJob($recordId, $storedPath);
        }

        return response()->json([
            'ok' => true,
            'record' => $recordData,
        ], 201);
    }

    private function isMediaFile(string $fileName): bool
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $mediaExtensions = config('ingest.media_extensions', []);

        return in_array($extension, $mediaExtensions, true);
    }

    private function enqueueMediaJob(string $recordId, string $filePath): void
    {
        $jobId = (string) Str::uuid();
        $now = now();

        DB::table('media_jobs')->insert([
            'id' => $jobId,
            'record_id' => $recordId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'source_path' => $filePath,
            'options' => json_encode([], JSON_THROW_ON_ERROR),
            'queued_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        ProcessMediaWorkflow::dispatch($jobId);
    }
}
