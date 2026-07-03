<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class UploadsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('ingest.disk'));
    }

    public function test_it_uploads_a_file_and_creates_an_archive_record(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->create('report.pdf', 100, 'application/pdf');

        $response = $this->postJson('/api/v1/uploads', [
            'file' => $file,
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true);

        $recordId = $response->json('record.id');
        $this->assertIsString($recordId);
        $this->assertSame('report.pdf', $response->json('record.fileName'));

        $this->assertDatabaseHas('storage_rows', [
            'store' => 'archive-items',
            'uid' => $recordId,
        ]);
    }

    public function test_it_enqueues_a_media_job_for_media_uploads(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4');

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertCreated();

        $this->assertSame(1, DB::table('media_jobs')->count());
    }

    public function test_it_does_not_enqueue_a_media_job_for_non_media_uploads(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->create('notes.txt', 10, 'text/plain');

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertCreated();

        $this->assertSame(0, DB::table('media_jobs')->count());
    }

    public function test_it_rejects_missing_file(): void
    {
        $this->postJson('/api/v1/uploads', [], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_it_rejects_disallowed_extension(): void
    {
        $file = UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload');

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_it_rejects_oversized_files(): void
    {
        $file = UploadedFile::fake()->create('huge.mp4', 600 * 1024 + 1, 'video/mp4');

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_it_requires_authentication(): void
    {
        $file = UploadedFile::fake()->create('report.pdf', 10, 'application/pdf');

        $this->postJson('/api/v1/uploads', ['file' => $file])
            ->assertUnauthorized();
    }
}
