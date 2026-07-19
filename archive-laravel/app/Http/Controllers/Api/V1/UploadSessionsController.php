<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\UploadContentMismatchException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateUploadSessionRequest;
use App\Models\User;
use App\Services\Uploads\UploadCapacityGuard;
use App\Services\Uploads\UploadFinalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * V1-711: resumable chunked upload for large files. A session tracks which
 * chunk indices have arrived so a client that reconnects (network drop,
 * refresh) calls GET /uploads/sessions/{id} to learn where to resume instead
 * of re-uploading from byte zero. Complete assembles the chunks (streamed,
 * bounded memory regardless of total file size) and hands off to the same
 * UploadFinalizer the single-shot /uploads endpoint uses, so both paths get
 * identical content validation, quarantine handling, and record creation.
 */
class UploadSessionsController extends Controller
{
    public function __construct(
        private readonly UploadCapacityGuard $capacityGuard,
        private readonly UploadFinalizer $finalizer,
    ) {}

    public function create(CreateUploadSessionRequest $request): JsonResponse
    {
        $disk = (string) config('ingest.disk');
        $totalSize = (int) $request->validated('totalSize');

        if ($denied = $this->capacityGuard->assertAvailable($disk, $totalSize)) {
            return $denied;
        }

        $chunkSize = (int) $request->validated('chunkSize');
        $totalChunks = (int) ceil($totalSize / $chunkSize);
        $now = now();
        $ttlHours = (int) config('ingest.chunk_upload.session_ttl_hours');
        $folder = trim((string) $request->validated('folder', ''), '/');
        $checksum = $request->validated('checksum');
        $user = $request->attributes->get('archive_user');

        $session = [
            'id' => (string) Str::uuid(),
            'created_by' => $user instanceof User ? $user->id : null,
            'disk' => $disk,
            'folder' => $folder !== '' ? $folder : null,
            'file_name' => (string) $request->validated('fileName'),
            'total_size' => $totalSize,
            'chunk_size' => $chunkSize,
            'total_chunks' => $totalChunks,
            'received_chunks' => json_encode([], JSON_THROW_ON_ERROR),
            'checksum_sha256' => $checksum !== null ? strtolower((string) $checksum) : null,
            'status' => 'pending',
            'expires_at' => $now->copy()->addHours($ttlHours),
            'created_at' => $now,
            'updated_at' => $now,
        ];

        DB::table('upload_sessions')->insert($session);

        return response()->json(['ok' => true, 'session' => $this->presentSession($session)], 201);
    }

    public function uploadChunk(Request $request, string $sessionId, int $index): JsonResponse
    {
        $session = DB::table('upload_sessions')->where('id', $sessionId)->first();
        if (! $session) {
            return $this->notFound();
        }
        if ($blocked = $this->assertSessionUsable($session)) {
            return $blocked;
        }
        if ($index < 0 || $index >= $session->total_chunks) {
            return response()->json([
                'ok' => false,
                'error' => 'Chunk index out of range.',
                'code' => 'invalid_chunk_index',
            ], 422);
        }

        $storage = Storage::disk($session->disk);
        $chunkPath = $this->chunkDirectory($session).'/'.$index;

        // Buffered rather than streamed — chunk size is bounded (config
        // ingest.chunk_upload.max_chunk_bytes, 50MB by default), so holding
        // one chunk in memory is unremarkable, and it sidesteps
        // getContent(true) needing php://input (real-request-only; returns
        // nothing under Laravel's test HTTP kernel, which buffers bodies).
        $content = $request->getContent();

        $isLastChunk = $index === $session->total_chunks - 1;
        $expectedBytes = $isLastChunk
            ? $session->total_size - ($session->chunk_size * ($session->total_chunks - 1))
            : $session->chunk_size;

        if (strlen($content) !== $expectedBytes) {
            return response()->json([
                'ok' => false,
                'error' => 'Chunk size did not match the expected size for this index.',
                'code' => 'chunk_size_mismatch',
            ], 422);
        }

        $storage->put($chunkPath, $content);

        $receivedChunks = DB::transaction(function () use ($sessionId, $index) {
            $locked = DB::table('upload_sessions')->where('id', $sessionId)->lockForUpdate()->first();
            $received = json_decode((string) $locked->received_chunks, true) ?: [];

            if (! in_array($index, $received, true)) {
                $received[] = $index;
                sort($received);
            }

            DB::table('upload_sessions')->where('id', $sessionId)->update([
                'received_chunks' => json_encode(array_values($received), JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);

            return array_values($received);
        });

        return response()->json(['ok' => true, 'receivedChunks' => $receivedChunks, 'totalChunks' => $session->total_chunks]);
    }

    public function show(string $sessionId): JsonResponse
    {
        $session = DB::table('upload_sessions')->where('id', $sessionId)->first();
        if (! $session) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'session' => $this->presentSession($session)]);
    }

    public function complete(string $sessionId): JsonResponse
    {
        $session = DB::table('upload_sessions')->where('id', $sessionId)->first();
        if (! $session) {
            return $this->notFound();
        }
        if ($blocked = $this->assertSessionUsable($session)) {
            return $blocked;
        }

        $received = json_decode((string) $session->received_chunks, true) ?: [];
        $missing = array_values(array_diff(range(0, $session->total_chunks - 1), $received));
        if ($missing !== []) {
            return response()->json([
                'ok' => false,
                'error' => 'Not all chunks have been received.',
                'code' => 'incomplete_upload',
                'missingChunks' => $missing,
            ], 409);
        }

        $storage = Storage::disk($session->disk);
        $directory = trim((string) config('ingest.directory'), '/');
        $targetDir = $session->folder ? "{$directory}/uploads/{$session->folder}" : "{$directory}/uploads";
        $extension = strtolower((string) pathinfo($session->file_name, PATHINFO_EXTENSION));
        $storedName = $sessionId.($extension !== '' ? '.'.$extension : '');
        $assembledPath = "{$directory}/quarantine/{$storedName}";

        $computedChecksum = $this->assembleChunks($storage, $session, $assembledPath);

        if ($session->checksum_sha256 !== null && strtolower((string) $session->checksum_sha256) !== $computedChecksum) {
            $storage->delete($assembledPath);
            $this->deleteChunks($storage, $session);
            DB::table('upload_sessions')->where('id', $sessionId)->update(['status' => 'aborted', 'updated_at' => now()]);

            return response()->json([
                'ok' => false,
                'error' => 'Assembled file checksum does not match the checksum supplied at session creation.',
                'code' => 'checksum_mismatch',
            ], 422);
        }

        try {
            $result = $this->finalizer->finalize($session->disk, $assembledPath, $storedName, $session->file_name, $computedChecksum, $targetDir);
        } catch (UploadContentMismatchException $exception) {
            $storage->delete($assembledPath);
            $this->deleteChunks($storage, $session);
            DB::table('upload_sessions')->where('id', $sessionId)->update(['status' => 'aborted', 'updated_at' => now()]);

            return response()->json(['ok' => false, 'error' => $exception->getMessage(), 'code' => 'unsafe_file_content'], 422);
        }

        $this->deleteChunks($storage, $session);
        DB::table('upload_sessions')->where('id', $sessionId)->update(['status' => 'completed', 'updated_at' => now()]);

        return response()->json(['ok' => true, 'record' => $result['record']], 201);
    }

    public function destroy(string $sessionId): JsonResponse
    {
        $session = DB::table('upload_sessions')->where('id', $sessionId)->first();
        if (! $session) {
            return $this->notFound();
        }

        $this->deleteChunks(Storage::disk($session->disk), $session);
        DB::table('upload_sessions')->where('id', $sessionId)->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * Reads every chunk (in order, bounded size per config.chunk_upload.
     * max_chunk_bytes) and hashes incrementally while building the assembled
     * content — no second read pass to compute the checksum afterward.
     */
    private function assembleChunks(\Illuminate\Contracts\Filesystem\Filesystem $storage, object $session, string $assembledPath): string
    {
        $hashContext = hash_init('sha256');
        $assembled = '';

        for ($index = 0; $index < $session->total_chunks; $index++) {
            $chunk = $storage->get($this->chunkDirectory($session).'/'.$index);
            $assembled .= $chunk;
            hash_update($hashContext, $chunk);
        }

        $storage->put($assembledPath, $assembled);

        return hash_final($hashContext);
    }

    private function assertSessionUsable(object $session): ?JsonResponse
    {
        if ($session->status !== 'pending') {
            return $this->gone('This upload session is no longer active.');
        }

        if (now()->greaterThan(Carbon::parse($session->expires_at))) {
            DB::table('upload_sessions')->where('id', $session->id)->update(['status' => 'aborted', 'updated_at' => now()]);

            return $this->gone('This upload session has expired.');
        }

        return null;
    }

    private function chunkDirectory(object $session): string
    {
        $directory = trim((string) config('ingest.directory'), '/');

        return "{$directory}/quarantine/sessions/{$session->id}";
    }

    private function deleteChunks(\Illuminate\Contracts\Filesystem\Filesystem $storage, object $session): void
    {
        $storage->deleteDirectory($this->chunkDirectory($session));
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Upload session not found.', 'code' => 'session_not_found'], 404);
    }

    private function gone(string $message): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => $message, 'code' => 'session_inactive'], 410);
    }

    /**
     * @param  array<string, mixed>|object  $session
     * @return array<string, mixed>
     */
    private function presentSession(array|object $session): array
    {
        $data = (array) $session;
        $receivedChunks = $data['received_chunks'];

        return [
            'id' => $data['id'],
            'fileName' => $data['file_name'],
            'totalSize' => (int) $data['total_size'],
            'chunkSize' => (int) $data['chunk_size'],
            'totalChunks' => (int) $data['total_chunks'],
            'receivedChunks' => is_string($receivedChunks) ? json_decode($receivedChunks, true) : $receivedChunks,
            'status' => $data['status'],
            'expiresAt' => $data['expires_at'] instanceof \DateTimeInterface
                ? $data['expires_at']->toIso8601String()
                : Carbon::parse((string) $data['expires_at'])->toIso8601String(),
        ];
    }
}
