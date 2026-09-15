<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class UnusedFilesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    private string $root;

    /**
     * Both tests used to write into the real storage/app/private and read the
     * endpoint's listing back. That listing stops at 200 entries in filesystem
     * order, so once a developer's storage had accumulated more than that from
     * live-gate runs, the orphan assertion failed and — worse — the
     * "not flagged" assertion started passing for the wrong reason: the file
     * it looked for had simply been truncated off the end. An empty root of
     * this test's own removes both, and leaves the developer's files alone.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->root = storage_path('framework/testing/unused-files-'.Str::uuid());
        File::ensureDirectoryExists($this->root);
        config(['archive.file_root' => $this->root]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->root);

        parent::tearDown();
    }

    public function test_it_flags_a_file_with_no_attachment_reference(): void
    {
        file_put_contents($this->root.DIRECTORY_SEPARATOR.'orphan-test-file.txt', 'orphan');

        $response = $this->getJson('/api/v1/files/unused', $this->authHeaders())->assertOk();

        $keys = collect($response->json('files'))->pluck('key');
        $this->assertContains('orphan-test-file.txt', $keys);
    }

    public function test_it_does_not_flag_a_file_referenced_by_an_attachment(): void
    {
        file_put_contents($this->root.DIRECTORY_SEPARATOR.'referenced-test-file.txt', 'kept');
        file_put_contents($this->root.DIRECTORY_SEPARATOR.'orphan-test-file.txt', 'orphan');

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

        $response = $this->getJson('/api/v1/files/unused', $this->authHeaders())->assertOk();

        $keys = collect($response->json('files'))->pluck('key');
        $this->assertNotContains('referenced-test-file.txt', $keys);
        // Without this the assertion above would also hold for an endpoint
        // that returned nothing at all.
        $this->assertContains('orphan-test-file.txt', $keys);
    }
}
