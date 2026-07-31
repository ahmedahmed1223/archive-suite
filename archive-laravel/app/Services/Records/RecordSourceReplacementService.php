<?php

namespace App\Services\Records;

use App\Jobs\ProcessMediaWorkflow;
use App\Services\Uploads\UploadFileValidator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

final class RecordSourceReplacementService
{
    public function __construct(private readonly UploadFileValidator $validator) {}

    public function replace(string $id, UploadedFile $file, ?int $actorId): array
    {
        $row = DB::table('storage_rows')->where(['store' => 'archive-items', 'uid' => $id])->first();
        if ($row === null) throw new RuntimeException('Record not found.');
        $before = json_decode($row->data, true, flags: JSON_THROW_ON_ERROR);
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $this->validator->assertSafeContent((string) file_get_contents($file->getRealPath(), false, null, 0, 8192), $extension);
        $disk = (string) config('ingest.disk'); $directory = trim((string) config('ingest.directory'), '/').'/replacements/'.$id;
        $storedName = (string) Str::uuid().($extension === '' ? '' : '.'.$extension); $path = $file->storeAs($directory, $storedName, ['disk' => $disk]);
        $after = [...$before, 'fileName' => $file->getClientOriginalName(), 'filePath' => $path, 'checksum' => hash_file('sha256', $file->getRealPath()), 'updatedAt' => now()->toIso8601String()];
        DB::transaction(function () use ($id, $before, $after, $actorId): void {
            DB::table('record_source_versions')->insert(['id' => (string) Str::uuid(), 'record_store' => 'archive-items', 'record_uid' => $id, 'record_data' => json_encode($before, JSON_THROW_ON_ERROR), 'created_by' => $actorId, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('storage_rows')->where(['store' => 'archive-items', 'uid' => $id])->update(['data' => json_encode($after, JSON_THROW_ON_ERROR), 'updated_at' => now()]);
        });
        $this->queueDerivative($id, $path, $after['fileName']);
        return $after;
    }
    public function restore(string $id, string $versionId): array
    {
        $version = DB::table('record_source_versions')->where(['id' => $versionId, 'record_store' => 'archive-items', 'record_uid' => $id])->first();
        if ($version === null) throw new RuntimeException('Source version not found.');
        $data = json_decode($version->record_data, true, flags: JSON_THROW_ON_ERROR); $data['updatedAt'] = now()->toIso8601String();
        DB::table('storage_rows')->where(['store' => 'archive-items', 'uid' => $id])->update(['data' => json_encode($data, JSON_THROW_ON_ERROR), 'updated_at' => now()]);
        $this->queueDerivative($id, $data['filePath'], $data['fileName']); return $data;
    }
    private function queueDerivative(string $recordId, string $path, string $fileName): void
    {
        if (! in_array(strtolower(pathinfo($fileName, PATHINFO_EXTENSION)), (array) config('ingest.media_extensions', []), true)) return;
        $jobId = (string) Str::uuid(); $now = now(); DB::table('media_jobs')->insert(['id'=>$jobId,'record_id'=>$recordId,'operation'=>'thumbnail','status'=>'queued','source_path'=>$path,'options'=>json_encode([]),'queued_at'=>$now,'created_at'=>$now,'updated_at'=>$now]); ProcessMediaWorkflow::dispatch($jobId);
    }
}
