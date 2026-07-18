<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\UploadContentMismatchException;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Uploads\UploadFileValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use stdClass;

class RecordAttachmentsController extends Controller
{
    public function __construct(private readonly UploadFileValidator $validator) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate(['store' => ['nullable', 'string']]);
        $store = (string) ($validated['store'] ?? 'archive-items');
        if (! $this->recordExists($store, $id)) return $this->notFound();

        return response()->json(['ok' => true, 'attachments' => DB::table('record_attachments')
            ->where(['record_store' => $store, 'record_uid' => $id])->orderByDesc('is_primary')->orderBy('created_at')->get()->map(fn ($row) => $this->format($row))->all()]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $allowed = array_merge((array) config('ingest.media_extensions', []), ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md','csv','zip']);
        $validated = $request->validate([
            'store' => ['nullable', 'string'],
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => ['required', 'file', 'max:614400', 'extensions:'.implode(',', $allowed)],
        ]);
        $store = (string) ($validated['store'] ?? 'archive-items');
        if (! $this->recordExists($store, $id)) return $this->notFound();
        $disk = (string) config('ingest.disk');
        $directory = trim((string) config('ingest.directory'), '/').'/attachments/'.$id;
        $storage = Storage::disk($disk);
        $actor = $request->attributes->get('archive_user');
        $attachments = [];

        foreach ($request->file('files', []) as $file) {
            $extension = strtolower((string) $file->getClientOriginalExtension());
            try { $this->validator->assertSafeContent((string) file_get_contents($file->getRealPath(), false, null, 0, 8192), $extension); }
            catch (UploadContentMismatchException $e) { return response()->json(['ok' => false, 'error' => $e->getMessage(), 'code' => 'unsafe_file_content'], 422); }
        }

        foreach ($request->file('files', []) as $file) {
            $extension = strtolower((string) $file->getClientOriginalExtension());
            $attachmentId = (string) Str::uuid();
            $path = $directory.'/'.$attachmentId.($extension !== '' ? '.'.$extension : '');
            $storage->putFileAs($directory, $file, basename($path));
            try {
                DB::table('record_attachments')->insert([
                    'id' => $attachmentId, 'record_store' => $store, 'record_uid' => $id, 'disk' => $disk, 'path' => $path,
                    'original_name' => $file->getClientOriginalName(), 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(),
                    'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
                    'is_primary' => DB::table('record_attachments')->where(['record_store' => $store, 'record_uid' => $id])->doesntExist(),
                    'processing_status' => 'ready', 'created_by' => $actor instanceof User ? $actor->id : null, 'created_at' => now(), 'updated_at' => now(),
                ]);
            } catch (\Throwable $e) { $storage->delete($path); throw $e; }
            $attachments[] = $this->format(DB::table('record_attachments')->where('id', $attachmentId)->first());
        }
        return response()->json(['ok' => true, 'attachments' => $attachments], 201);
    }

    public function destroy(Request $request, string $id, string $attachmentId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $store = (string) $request->input('store', 'archive-items');
        $row = DB::table('record_attachments')->where(['id' => $attachmentId, 'record_store' => $store, 'record_uid' => $id])->first();
        if (! $row instanceof stdClass) return $this->notFound();
        DB::table('record_attachments')->where('id', $attachmentId)->delete();
        Storage::disk($row->disk)->delete($row->path);
        return response()->json(['ok' => true, 'deleted' => true]);
    }

    private function recordExists(string $store, string $id): bool { return DB::table('storage_rows')->where(['store' => $store, 'uid' => $id])->exists(); }
    private function notFound(): JsonResponse { return response()->json(['ok' => false, 'error' => 'Record not found.', 'code' => 'not_found'], 404); }
    private function format(stdClass $row): array { return ['id'=>$row->id,'recordStore'=>$row->record_store,'recordUid'=>$row->record_uid,'disk'=>$row->disk,'path'=>$row->path,'originalName'=>$row->original_name,'mimeType'=>$row->mime_type,'sizeBytes'=>(int)$row->size_bytes,'checksumSha256'=>$row->checksum_sha256,'isPrimary'=>(bool)$row->is_primary,'processingStatus'=>$row->processing_status,'createdAt'=>$row->created_at]; }
}
