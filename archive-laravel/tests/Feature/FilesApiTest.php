<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class FilesApiTest extends TestCase
{
    private string $fileRoot;

    protected function setUp(): void
    {
        parent::setUp();

        config(['archive.api_key' => 'test-secret']);

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

    /**
     * @return array<string, string>
     */
    private function authHeaders(): array
    {
        return ['X-Archive-Api-Key' => 'test-secret'];
    }
}
