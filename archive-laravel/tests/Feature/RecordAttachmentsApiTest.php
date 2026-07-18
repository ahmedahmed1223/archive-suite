<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordAttachmentsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('ingest.disk'));
    }

    public function test_editor_creates_a_valid_record_without_files(): void
    {
        $response = $this->postJson('/api/v1/records', [
            'title' => 'Oral history description',
            'description' => 'No media has arrived yet.',
            'type' => 'document',
            'tags' => ['oral-history'],
        ], $this->authHeaders())->assertCreated()
            ->assertJsonPath('record.attachmentCount', 0);

        $this->assertDatabaseHas('storage_rows', ['store' => 'archive-items', 'uid' => $response->json('record.id')]);
    }

    public function test_multiple_files_can_be_attached_listed_and_deleted(): void
    {
        $record = $this->postJson('/api/v1/records', ['title' => 'Multi-file record'], $this->authHeaders())->json('record');
        $id = $record['id'];

        $upload = $this->post('/api/v1/records/'.$id.'/attachments', [
            'store' => 'archive-items',
            'files' => [
                UploadedFile::fake()->createWithContent('notes.txt', 'notes'),
                UploadedFile::fake()->createWithContent('report.pdf', "%PDF-1.4\npadding"),
            ],
        ], $this->authHeaders())->assertCreated()->assertJsonCount(2, 'attachments');

        $attachmentId = $upload->json('attachments.0.id');
        $this->getJson('/api/v1/records/'.$id.'/attachments?store=archive-items', $this->authHeaders())
            ->assertOk()->assertJsonCount(2, 'attachments');

        $this->deleteJson('/api/v1/records/'.$id.'/attachments/'.$attachmentId.'?store=archive-items', [], $this->authHeaders())
            ->assertOk()->assertJsonPath('deleted', true);
        $this->assertDatabaseCount('record_attachments', 1);
    }
}
