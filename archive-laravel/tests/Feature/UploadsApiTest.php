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

    /** Minimal but real MP4 "ftyp" box header — enough for finfo to sniff video/mp4. */
    private const REAL_MP4_HEADER = "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" . "\x00\x00\x00\x00\x00\x00\x00\x00";

    public function test_it_uploads_a_file_and_creates_an_archive_record(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->createWithContent('report.pdf', "%PDF-1.4\n%\xe2\xe3\xcf\xd3\npadding padding padding");

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

        // The file must be servable (present, non-empty) at its stored path
        // once validation passes — the quarantine tier only blocks unsafe
        // content, not legitimate uploads.
        $storedPath = $response->json('record.filePath');
        Storage::disk(config('ingest.disk'))->assertExists($storedPath);
    }

    public function test_it_stores_uploads_under_a_uuid_filename_not_the_client_supplied_name(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->createWithContent('report.pdf', "%PDF-1.4\n%\xe2\xe3\xcf\xd3\npadding");

        $response = $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertCreated();

        $storedPath = $response->json('record.filePath');
        $storedName = basename((string) $storedPath);

        $this->assertNotSame('report.pdf', $storedName);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/',
            $storedName,
        );
    }

    public function test_it_enqueues_a_media_job_for_media_uploads(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->createWithContent('clip.mp4', self::REAL_MP4_HEADER);

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertCreated();

        $this->assertSame(1, DB::table('media_jobs')->count());
    }

    public function test_it_uploads_wav_audio_without_an_invalid_thumbnail_job(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->createWithContent('acceptance.wav', "RIFF\x24\x00\x00\x00WAVEfmt ".str_repeat("\x00", 48));

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('record.fileName', 'acceptance.wav');

        $this->assertSame(0, DB::table('media_jobs')->count());
    }

    public function test_it_does_not_enqueue_a_media_job_for_non_media_uploads(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->createWithContent('notes.txt', 'hello world, this is plain text.');

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertCreated();

        $this->assertSame(0, DB::table('media_jobs')->count());
    }

    public function test_it_rejects_a_php_script_disguised_with_an_image_extension(): void
    {
        Queue::fake();

        $file = UploadedFile::fake()->createWithContent(
            'innocent.jpg',
            "<?php echo shell_exec(\$_GET['cmd']); ?>",
        );

        $response = $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'unsafe_file_content');

        // Nothing should have been persisted for a rejected upload.
        $this->assertSame(0, DB::table('storage_rows')->count());
        $this->assertSame(0, DB::table('media_jobs')->count());
        $this->assertIsString($response->json('error'));

        // And nothing should linger in quarantine either.
        Storage::disk(config('ingest.disk'))->assertDirectoryEmpty(
            trim((string) config('ingest.directory'), '/').'/quarantine',
        );
    }

    public function test_it_rejects_a_zip_disguised_with_a_pdf_extension(): void
    {
        Queue::fake();

        // Real ZIP local-file-header signature, but claiming to be a PDF.
        $file = UploadedFile::fake()->createWithContent('fake.pdf', "PK\x03\x04".str_repeat("\x00", 32));

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('code', 'unsafe_file_content');
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

    public function test_it_rejects_upload_when_free_disk_space_is_below_the_configured_margin(): void
    {
        // Force the "not enough headroom" branch without mocking disk_free_space():
        // require more free space than any real disk will ever report.
        config(['ingest.min_free_bytes' => PHP_INT_MAX]);

        $file = UploadedFile::fake()->createWithContent('report.pdf', "%PDF-1.4\n%\xe2\xe3\xcf\xd3\npadding");

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertStatus(507)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'insufficient_disk_space');

        $this->assertSame(0, DB::table('storage_rows')->count());
        Storage::disk(config('ingest.disk'))->assertDirectoryEmpty(
            trim((string) config('ingest.directory'), '/').'/quarantine',
        );
    }

    public function test_it_rejects_upload_when_it_would_exceed_the_storage_quota(): void
    {
        // Force the "over quota" branch without mocking disk_total_space():
        // a 1-byte quota is exceeded by disk usage on any real machine.
        config(['ingest.storage_quota_bytes' => 1]);

        $file = UploadedFile::fake()->createWithContent('report.pdf', "%PDF-1.4\n%\xe2\xe3\xcf\xd3\npadding");

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertStatus(413)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'storage_quota_exceeded');

        $this->assertSame(0, DB::table('storage_rows')->count());
        Storage::disk(config('ingest.disk'))->assertDirectoryEmpty(
            trim((string) config('ingest.directory'), '/').'/quarantine',
        );
    }

    public function test_it_uploads_normally_when_no_quota_is_configured(): void
    {
        Queue::fake();

        // Defaults: storage_quota_bytes is null (unlimited), min_free_bytes
        // is a small safety margin — neither should trip on a real test disk.
        $file = UploadedFile::fake()->createWithContent('report.pdf', "%PDF-1.4\n%\xe2\xe3\xcf\xd3\npadding");

        $this->postJson('/api/v1/uploads', ['file' => $file], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true);
    }

    public function test_it_requires_authentication(): void
    {
        $file = UploadedFile::fake()->create('report.pdf', 10, 'application/pdf');

        $this->postJson('/api/v1/uploads', ['file' => $file])
            ->assertUnauthorized();
    }
}
