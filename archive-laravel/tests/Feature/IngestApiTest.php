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

    public function test_watched_scan_defers_a_file_until_it_is_stable(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 60);
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');
        Storage::disk($disk)->put("$dir/still-copying.mp4", 'partial');

        $result = app(\App\Services\Ingest\IngestScanner::class)->scanWatched();

        $this->assertSame([], $result['ingested']);
        $this->assertSame(1, $result['skipped']);
    }

    public function test_watched_scan_creates_a_preview_batch_without_ingesting_records(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 0);
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');
        Storage::disk($disk)->put("$dir/watched/ready.mp4", 'ready media');

        $response = $this->postJson('/api/v1/ingest/watched/scan', [], $this->authHeaders());

        $response->assertCreated()
            ->assertJsonPath('batch.status', 'pending')
            ->assertJsonPath('batch.entries.0.fileName', 'ready.mp4');
        $this->assertDatabaseCount('watched_ingest_batches', 1);
        $this->assertDatabaseCount('watched_ingest_entries', 1);
        $this->assertDatabaseCount('storage_rows', 0);
    }

    public function test_watched_batch_requires_explicit_apply_before_creating_records(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 0);
        $disk = config('ingest.disk');
        $dir = config('ingest.directory');
        Storage::disk($disk)->put("$dir/watched/approved.txt", 'approved content');
        $preview = $this->postJson('/api/v1/ingest/watched/scan', [], $this->authHeaders())->assertCreated();

        $this->postJson('/api/v1/ingest/watched/batches/'.$preview->json('batch.id').'/apply', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('batch.status', 'completed');

        $this->assertDatabaseCount('storage_rows', 1);
        $this->assertDatabaseHas('watched_ingest_entries', ['status' => 'applied']);
    }

    public function test_watched_ingest_preview_is_classified_in_the_central_audit_log(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 0);
        Storage::disk(config('ingest.disk'))->put(config('ingest.directory').'/watched/audited.txt', 'audit me');

        $response = $this->postJson('/api/v1/ingest/watched/scan', [], $this->authHeaders())->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'POST /api/v1/ingest/watched/scan',
            'event' => 'watched_ingest.preview',
            'resource_type' => 'watched_ingest_batch',
            'outcome' => 'success',
            'status_code' => 201,
        ]);
        $this->assertSame($response->json('batch.id'), \Illuminate\Support\Facades\DB::table('audit_logs')->latest('id')->value('resource_id'));
    }

    public function test_watched_batch_quarantines_a_rejected_file_instead_of_leaving_it_for_another_scan(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 0);
        $disk = config('ingest.disk');
        $source = config('ingest.directory').'/watched/untrusted.jpg';
        Storage::disk($disk)->put($source, '<?php echo "not an image";');

        $preview = $this->postJson('/api/v1/ingest/watched/scan', [], $this->authHeaders())->assertCreated();
        $entry = $preview->json('batch.entries.0');
        $this->postJson('/api/v1/ingest/watched/batches/'.$preview->json('batch.id').'/apply', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('batch.entries.0.status', 'quarantined')
            ->assertJsonPath('batch.entries.0.reason', 'apply_failed');

        Storage::disk($disk)->assertMissing($source);
        Storage::disk($disk)->assertExists('ingest/quarantine/watched/'.$entry['id'].'.jpg');
        $this->assertDatabaseCount('storage_rows', 0);
    }

    public function test_watched_preview_isolates_a_checksum_conflict_before_it_can_be_applied(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 0);
        $disk = config('ingest.disk');
        $directory = config('ingest.directory');
        Storage::disk($disk)->put("$directory/already-archived.txt", 'same content');
        app(\App\Services\Ingest\IngestScanner::class)->scan();
        $source = "$directory/watched/conflict.txt";
        Storage::disk($disk)->put($source, 'same content');

        $preview = $this->postJson('/api/v1/ingest/watched/scan', [], $this->authHeaders())->assertCreated();
        $entry = $preview->json('batch.entries.0');

        $this->assertSame('quarantined', $entry['status']);
        $this->assertSame('duplicate_checksum', $entry['reason']);
        Storage::disk($disk)->assertMissing($source);
        Storage::disk($disk)->assertExists('ingest/quarantine/watched/'.$entry['id'].'.txt');
    }

    public function test_watched_rule_previews_and_applies_template_tags_and_staging_destination(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 0);
        $templateId = 'news-template';
        \Illuminate\Support\Facades\DB::table('metadata_templates')->insert([
            'id' => $templateId, 'name' => 'News', 'fields' => json_encode(['department' => 'news']), 'tags' => json_encode(['editorial']), 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->postJson('/api/v1/ingest/watched/rules', [
            'matchType' => 'filename_pattern', 'pattern' => '/^NEWS-/', 'metadataTemplateId' => $templateId,
            'tags' => ['urgent'], 'stagingDirectory' => 'ingest/watched/news',
        ], $this->authHeaders())->assertCreated();
        Storage::disk(config('ingest.disk'))->put(config('ingest.directory').'/watched/NEWS-001.txt', 'breaking news');

        $preview = $this->postJson('/api/v1/ingest/watched/scan', [], $this->authHeaders())->assertCreated();
        $preview->assertJsonPath('batch.entries.0.routing.metadataTemplateId', $templateId);
        $preview->assertJsonPath('batch.entries.0.routing.stagingDirectory', 'ingest/watched/news');

        $this->postJson('/api/v1/ingest/watched/batches/'.$preview->json('batch.id').'/apply', [], $this->authHeaders())->assertOk();
        $record = \Illuminate\Support\Facades\DB::table('storage_rows')->where('store', 'archive-items')->value('data');
        $this->assertIsString($record);
        $data = json_decode($record, true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame('ingest/watched/news', dirname($data['filePath']));
        $this->assertSame('news', $data['department']);
        $this->assertSame(['editorial', 'urgent'], $data['tags']);
    }

    public function test_watched_ingest_rules_can_be_listed_updated_and_removed_by_an_editor(): void
    {
        $created = $this->postJson('/api/v1/ingest/watched/rules', ['matchType' => 'path_prefix', 'pattern' => 'ingest/watched/news', 'stagingDirectory' => 'ingest/watched/news'], $this->authHeaders())->assertCreated();
        $id = $created->json('rule.id');
        $this->getJson('/api/v1/ingest/watched/rules', $this->authHeaders())->assertOk()->assertJsonPath('rules.0.id', $id);
        $this->patchJson('/api/v1/ingest/watched/rules/'.$id, ['matchType' => 'path_prefix', 'pattern' => 'ingest/watched/edited', 'stagingDirectory' => 'ingest/watched/edited'], $this->authHeaders())->assertOk()->assertJsonPath('rule.pattern', 'ingest/watched/edited');
        $this->deleteJson('/api/v1/ingest/watched/rules/'.$id, [], $this->authHeaders())->assertOk();
    }

    public function test_watched_rule_matches_a_source_path_prefix(): void
    {
        config()->set('ingest.watched.min_stable_seconds', 0);
        $this->postJson('/api/v1/ingest/watched/rules', ['matchType' => 'path_prefix', 'pattern' => 'ingest/watched/news/', 'stagingDirectory' => 'ingest/watched/news'], $this->authHeaders())->assertCreated();
        Storage::disk(config('ingest.disk'))->put(config('ingest.directory').'/watched/news/report.txt', 'news report');

        $this->postJson('/api/v1/ingest/watched/scan', [], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('batch.entries.0.routing.stagingDirectory', 'ingest/watched/news');
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

    public function test_dropbox_pull_uses_transport_then_scans(): void
    {
        Queue::fake();

        $response = $this->postJson('/api/v1/ingest/dropbox/pull', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true);

        // Transport is fake (default in tests), returns empty, so scan finds 0.
        // Verifies the endpoint requires no per-request credentials, unlike
        // ftp/smb -- there is nothing to validate() here.
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

        $this->postJson('/api/v1/ingest/dropbox/pull')
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
