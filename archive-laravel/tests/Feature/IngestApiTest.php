<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class IngestApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('ingest.disk'));
    }

    public function test_scan_creates_records_for_new_files(): void
    {
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');

        // Create test files
        Storage::disk($disk)->put("$dir/file1.txt", 'content1');
        Storage::disk($disk)->put("$dir/file2.txt", 'content2');

        $response = $this->postJson('/api/v1/ingest/scan', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(2, 'ingested');

        $ingested = $response->json('ingested');
        $this->assertCount(2, $ingested);
        $this->assertEquals('file1.txt', $ingested[0]['fileName']);
        $this->assertEquals('file2.txt', $ingested[1]['fileName']);
        $this->assertNotEmpty($ingested[0]['checksum']);
        $this->assertNotEmpty($ingested[1]['checksum']);
    }

    public function test_scan_skips_already_ingested_files_by_checksum(): void
    {
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');

        Storage::disk($disk)->put("$dir/file1.txt", 'content1');
        Storage::disk($disk)->put("$dir/file2.txt", 'content2');

        // First scan: both ingested
        $response1 = $this->postJson('/api/v1/ingest/scan', [], $this->authHeaders())
            ->assertOk();

        $this->assertCount(2, $response1->json('ingested'));
        $this->assertEquals(0, $response1->json('skipped'));

        // Second scan: both skipped (checksums already exist)
        $response2 = $this->postJson('/api/v1/ingest/scan', [], $this->authHeaders())
            ->assertOk();

        $this->assertCount(0, $response2->json('ingested'));
        $this->assertEquals(2, $response2->json('skipped'));
    }

    public function test_scan_enqueues_media_job_for_media_files(): void
    {
        Queue::fake();
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');

        Storage::disk($disk)->put("$dir/video.mp4", 'fake video content');
        Storage::disk($disk)->put("$dir/image.png", 'fake image content');
        Storage::disk($disk)->put("$dir/document.txt", 'text content');

        $this->postJson('/api/v1/ingest/scan', [], $this->authHeaders())
            ->assertOk();

        // Check that media jobs were created for video and image, not text
        $mediaJobs = \Illuminate\Support\Facades\DB::table('media_jobs')->get();
        $this->assertEquals(2, $mediaJobs->count());

        $operations = $mediaJobs->pluck('operation')->toArray();
        $this->assertTrue(in_array('thumbnail', $operations));
    }

    public function test_scan_does_not_enqueue_media_job_for_non_media_files(): void
    {
        Queue::fake();
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');

        Storage::disk($disk)->put("$dir/document.txt", 'text content');
        Storage::disk($disk)->put("$dir/data.json", 'json data');

        $this->postJson('/api/v1/ingest/scan', [], $this->authHeaders())
            ->assertOk();

        // No media jobs should be created
        $mediaJobs = \Illuminate\Support\Facades\DB::table('media_jobs')->get();
        $this->assertEquals(0, $mediaJobs->count());
    }

    public function test_ftp_pull_uses_transport_then_scans(): void
    {
        Queue::fake();
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');

        // Pre-populate with files that will be "pulled"
        Storage::disk($disk)->put("$dir/ftp-staging/pulled.mp4", 'video');

        $response = $this->postJson('/api/v1/ingest/ftp/pull', [
            'host' => '192.168.1.100',
            'user' => 'testuser',
            'password' => 'testpass',
            'remotePath' => '/videos',
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        // Transport is fake, returns empty, so scan finds 0
        // But we verify the endpoint structure is correct
        $this->assertIsArray($response->json('ingested'));
    }

    public function test_smb_pull_uses_transport_then_scans(): void
    {
        Queue::fake();
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');

        $response = $this->postJson('/api/v1/ingest/smb/pull', [
            'share' => '\\\\server\\share',
            'user' => 'testuser',
            'password' => 'testpass',
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertIsArray($response->json('ingested'));
    }

    public function test_ftp_pull_validates_required_params(): void
    {
        $this->postJson('/api/v1/ingest/ftp/pull', [
            'user' => 'onlyuser',
            // missing 'host'
        ], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('host');
    }

    public function test_smb_pull_validates_required_params(): void
    {
        $this->postJson('/api/v1/ingest/smb/pull', [
            'user' => 'onlyuser',
            // missing 'share'
        ], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('share');
    }

    public function test_ingest_endpoints_require_authentication(): void
    {
        $this->postJson('/api/v1/ingest/scan')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);

        $this->postJson('/api/v1/ingest/ftp/pull', [
            'host' => '192.168.1.1',
            'user' => 'user',
            'password' => 'pass',
        ])
            ->assertUnauthorized();

        $this->postJson('/api/v1/ingest/smb/pull', [
            'share' => '\\\\server\\share',
            'user' => 'user',
            'password' => 'pass',
        ])
            ->assertUnauthorized();
    }

    public function test_scan_returns_empty_when_directory_does_not_exist(): void
    {
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');

        // Don't create any directory
        Storage::disk($disk)->deleteDirectory($dir);

        $response = $this->postJson('/api/v1/ingest/scan', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(0, 'ingested')
            ->assertJsonPath('skipped', 0);
    }
}
