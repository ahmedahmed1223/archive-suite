<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class FilesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    private string $fileRoot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fileRoot = storage_path('framework/testing/archive-files');
        File::deleteDirectory($this->fileRoot);
        File::makeDirectory($this->fileRoot.'/video', 0755, true);
        File::put($this->fileRoot.'/video/clip.txt', 'archive clip');
        File::put($this->fileRoot.'/readme.md', '# Archive');
        config(['archive.file_root' => $this->fileRoot]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->fileRoot);

        parent::tearDown();
    }

    public function test_it_lists_files_recursively(): void
    {
        $this->getJson('/api/v1/files', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(2, 'files')
            ->assertJsonPath('files.0.kind', 'file');
    }

    public function test_it_browses_directories_and_filters_by_query(): void
    {
        $this->getJson('/api/v1/files/browser?path=video&query=clip', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('path', 'video')
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.name', 'clip.txt')
            ->assertJsonPath('items.0.kind', 'file');
    }

    public function test_it_rejects_path_traversal(): void
    {
        $this->getJson('/api/v1/files/browser?path=../', $this->authHeaders())
            ->assertStatus(400)
            ->assertJsonPath('ok', false);
    }

    public function test_it_rejects_unauthenticated_file_requests(): void
    {
        $this->getJson('/api/v1/files')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_it_streams_a_full_file_with_range_support(): void
    {
        $response = $this->get('/api/v1/files/stream?path=video/clip.txt', $this->authHeaders());

        $response->assertOk();
        $this->assertSame('bytes', $response->headers->get('Accept-Ranges'));
        $this->assertSame('archive clip', $response->streamedContent());
    }

    public function test_it_serves_a_partial_range_request(): void
    {
        $response = $this->get('/api/v1/files/stream?path=video/clip.txt', array_merge(
            $this->authHeaders(),
            ['Range' => 'bytes=0-6'],
        ));

        $response->assertStatus(206);
        $this->assertSame('bytes 0-6/12', $response->headers->get('Content-Range'));
        $this->assertSame('archive', $response->streamedContent());
    }

    public function test_it_rejects_an_unsatisfiable_range(): void
    {
        $this->get('/api/v1/files/stream?path=video/clip.txt', array_merge(
            $this->authHeaders(),
            ['Range' => 'bytes=1000-2000'],
        ))->assertStatus(416);
    }

    public function test_it_rejects_a_missing_or_unresolvable_media_path(): void
    {
        // ponytail: realpath-based safety can't distinguish missing from traversal,
        // so both non-existent and escaping paths return 400 (invalid media path).
        $this->getJson('/api/v1/files/stream?path=video/missing.mp4', $this->authHeaders())
            ->assertStatus(400)
            ->assertJsonPath('ok', false);
    }

    public function test_it_rejects_stream_path_traversal(): void
    {
        $this->getJson('/api/v1/files/stream?path=../secrets', $this->authHeaders())
            ->assertStatus(400)
            ->assertJsonPath('ok', false);
    }

    public function test_it_rejects_unauthenticated_stream(): void
    {
        $this->getJson('/api/v1/files/stream?path=video/clip.txt')
            ->assertUnauthorized();
    }

    public function test_it_streams_from_a_configured_disk(): void
    {
        // Arrange: configure a test 'local' disk with a fixture file
        config(['filesystems.disks.local' => [
            'driver' => 'local',
            'root' => storage_path('framework/testing/archive-disk-local'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ]]);

        File::makeDirectory(storage_path('framework/testing/archive-disk-local'), 0755, true);
        File::put(storage_path('framework/testing/archive-disk-local/fixture.txt'), 'disk file content');

        // Act: stream from the disk
        $response = $this->get('/api/v1/files/stream?path=fixture.txt&disk=local', $this->authHeaders());

        // Assert: file is served
        $response->assertOk();
        $this->assertSame('disk file content', $response->streamedContent());

        // Cleanup
        File::deleteDirectory(storage_path('framework/testing/archive-disk-local'));
    }

    public function test_it_rejects_unknown_disk(): void
    {
        $this->getJson('/api/v1/files/stream?path=video/clip.txt&disk=nonexistent', $this->authHeaders())
            ->assertStatus(400)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('error', fn (string $msg): bool => str_contains($msg, 'disk'));
    }

    public function test_it_rejects_path_traversal_on_disk_streams(): void
    {
        config(['filesystems.disks.local' => [
            'driver' => 'local',
            'root' => storage_path('framework/testing/archive-disk-local'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ]]);

        File::makeDirectory(storage_path('framework/testing/archive-disk-local'), 0755, true);

        // Try to traverse up with .. segment
        $this->getJson('/api/v1/files/stream?path=..%2Fsecrets&disk=local', $this->authHeaders())
            ->assertStatus(400)
            ->assertJsonPath('ok', false);

        File::deleteDirectory(storage_path('framework/testing/archive-disk-local'));
    }

    public function test_missing_disk_param_uses_archive_file_root(): void
    {
        // Regression test: ensure no disk param falls back to ARCHIVE_FILE_ROOT with Range support
        $response = $this->get('/api/v1/files/stream?path=video/clip.txt', $this->authHeaders());

        $response->assertOk();
        $this->assertSame('bytes', $response->headers->get('Accept-Ranges'));
        $this->assertSame('archive clip', $response->streamedContent());
    }
}
