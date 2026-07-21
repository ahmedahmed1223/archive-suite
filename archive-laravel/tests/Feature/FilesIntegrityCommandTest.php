<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class FilesIntegrityCommandTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('ingest.disk'));
    }

    private function attachOneFile(): object
    {
        $record = $this->postJson('/api/v1/records', ['title' => 'Integrity check record'], $this->authHeaders())->json('record');

        $this->post('/api/v1/records/'.$record['id'].'/attachments', [
            'store' => 'archive-items',
            'files' => [UploadedFile::fake()->createWithContent('notes.txt', 'original content')],
        ], $this->authHeaders())->assertCreated();

        return DB::table('record_attachments')->orderByDesc('created_at')->first();
    }

    public function test_verify_integrity_passes_for_untouched_files(): void
    {
        $this->attachOneFile();

        $this->artisan('files:verify-integrity')->assertExitCode(0);
        $this->assertSame(0, DB::table('audit_logs')->where('event', 'attachment.integrity_failed')->count());
    }

    public function test_verify_integrity_flags_a_corrupted_file(): void
    {
        $attachment = $this->attachOneFile();

        Storage::disk($attachment->disk)->put($attachment->path, 'corrupted content');

        $this->artisan('files:verify-integrity', ['--json' => true])
            ->assertExitCode(1)
            ->expectsOutputToContain('checksum_mismatch');

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'attachment.integrity_failed',
            'resource_id' => $attachment->id,
        ]);
    }

    public function test_verify_integrity_flags_a_missing_file(): void
    {
        $attachment = $this->attachOneFile();

        Storage::disk($attachment->disk)->delete($attachment->path);

        $this->artisan('files:verify-integrity', ['--json' => true])
            ->assertExitCode(1)
            ->expectsOutputToContain('missing');
    }
}
