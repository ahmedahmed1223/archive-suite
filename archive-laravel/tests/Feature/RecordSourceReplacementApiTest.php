<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordSourceReplacementApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_replace_preserves_record_identity_and_snapshots_the_previous_source(): void
    {
        $disk = config('ingest.disk');
        Storage::fake($disk);
        Storage::disk($disk)->put('ingest/uploads/original.txt', 'original');
        DB::table('storage_rows')->insert(['store' => 'archive-items', 'uid' => 'record-1', 'data' => json_encode(['id' => 'record-1', 'uid' => 'record-1', 'title' => 'Original', 'fileName' => 'original.txt', 'filePath' => 'ingest/uploads/original.txt', 'checksum' => hash('sha256', 'original')]), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('record_comments')->insert(['id' => 'comment-1', 'item_id' => 'record-1', 'record_store' => 'archive-items', 'body' => 'keep me', 'created_at' => now(), 'updated_at' => now()]);

        $response = $this->post('/api/v1/records/record-1/source-replacements', ['file' => UploadedFile::fake()->createWithContent('replacement.txt', 'replacement')], $this->authHeaders());

        $response->assertOk()->assertJsonPath('record.id', 'record-1')->assertJsonPath('record.fileName', 'replacement.txt');
        $this->assertDatabaseHas('record_comments', ['id' => 'comment-1', 'item_id' => 'record-1']);
        $this->assertDatabaseCount('record_source_versions', 1);

        $versionId = DB::table('record_source_versions')->value('id');
        $this->postJson('/api/v1/records/record-1/source-versions/'.$versionId.'/restore', [], $this->authHeaders())
            ->assertOk()->assertJsonPath('record.id', 'record-1')->assertJsonPath('record.fileName', 'original.txt');
    }
}
