<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class UnusedFilesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_flags_a_file_with_no_attachment_reference(): void
    {
        $root = config('archive.file_root');
        file_put_contents($root.DIRECTORY_SEPARATOR.'orphan-test-file.txt', 'orphan');

        try {
            $response = $this->getJson('/api/v1/files/unused', $this->authHeaders())->assertOk();
            $keys = collect($response->json('files'))->pluck('key');
            $this->assertContains('orphan-test-file.txt', $keys);
        } finally {
            @unlink($root.DIRECTORY_SEPARATOR.'orphan-test-file.txt');
        }
    }

    public function test_it_does_not_flag_a_file_referenced_by_an_attachment(): void
    {
        $root = config('archive.file_root');
        file_put_contents($root.DIRECTORY_SEPARATOR.'referenced-test-file.txt', 'kept');

        DB::table('record_attachments')->insert([
            'id' => (string) Str::uuid(),
            'record_store' => 'archive-items',
            'record_uid' => 'item-1',
            'disk' => 'local',
            'path' => 'referenced-test-file.txt',
            'original_name' => 'referenced-test-file.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => 4,
            'checksum_sha256' => str_repeat('a', 64),
            'is_primary' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $response = $this->getJson('/api/v1/files/unused', $this->authHeaders())->assertOk();
            $keys = collect($response->json('files'))->pluck('key');
            $this->assertNotContains('referenced-test-file.txt', $keys);
        } finally {
            @unlink($root.DIRECTORY_SEPARATOR.'referenced-test-file.txt');
        }
    }
}
