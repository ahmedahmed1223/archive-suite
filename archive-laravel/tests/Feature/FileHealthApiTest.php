<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class FileHealthApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_a_matching_checksum_reports_match(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('health-test.txt', 'hello');
        $checksum = hash('sha256', 'hello');
        $attachmentId = $this->seedAttachment($checksum);

        $this->postJson("/api/v1/attachments/{$attachmentId}/health/check", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('check.status', 'match')
            ->assertJsonPath('check.checksumSha256', $checksum);

        $this->getJson("/api/v1/attachments/{$attachmentId}/health", $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'checks');
    }

    public function test_a_changed_file_reports_mismatch(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('health-test.txt', 'changed content');
        $attachmentId = $this->seedAttachment(hash('sha256', 'original content'));

        $this->postJson("/api/v1/attachments/{$attachmentId}/health/check", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('check.status', 'mismatch');
    }

    public function test_a_missing_file_reports_missing(): void
    {
        Storage::fake('local');
        $attachmentId = $this->seedAttachment(hash('sha256', 'x'), 'does-not-exist.txt');

        $this->postJson("/api/v1/attachments/{$attachmentId}/health/check", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('check.status', 'missing');
    }

    public function test_an_unknown_attachment_returns_not_found(): void
    {
        $this->postJson('/api/v1/attachments/00000000-0000-0000-0000-000000000000/health/check', [], $this->authHeaders())
            ->assertStatus(404);
    }

    private function seedAttachment(string $checksum, string $path = 'health-test.txt'): string
    {
        $id = (string) Str::uuid();
        DB::table('record_attachments')->insert([
            'id' => $id,
            'record_store' => 'archive-items',
            'record_uid' => 'item-1',
            'disk' => 'local',
            'path' => $path,
            'original_name' => $path,
            'mime_type' => 'text/plain',
            'size_bytes' => 5,
            'checksum_sha256' => $checksum,
            'is_primary' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }
}
