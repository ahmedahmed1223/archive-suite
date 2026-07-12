<?php

namespace Tests\Feature;

use App\Models\MediaJob;
use App\Models\User;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\MediaPathGuard;
use App\Services\Media\OcrClient;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\WhisperTranscriber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1-111: containment/ownership for media jobs.
 */
class MediaJobsContainmentTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    // -- store(): traversal / absolute-path rejection -----------------------

    public function test_store_rejects_absolute_source_path(): void
    {
        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-traversal-1',
            'operation' => 'ocr',
            'sourcePath' => '/etc/passwd',
        ], $this->authHeaders());

        $response->assertUnprocessable();
        $this->assertDatabaseMissing('media_jobs', ['record_id' => 'media-record-traversal-1']);
    }

    public function test_store_rejects_traversal_source_path(): void
    {
        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-traversal-2',
            'operation' => 'ocr',
            'sourcePath' => '../../.env',
        ], $this->authHeaders());

        $response->assertUnprocessable();
        $this->assertDatabaseMissing('media_jobs', ['record_id' => 'media-record-traversal-2']);
    }

    public function test_store_rejects_traversal_record_id(): void
    {
        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => '../../etc/passwd',
            'operation' => 'thumbnail',
            'sourcePath' => 'archive/source.mov',
        ], $this->authHeaders());

        $response->assertUnprocessable();
        $this->assertDatabaseMissing('media_jobs', ['operation' => 'thumbnail']);
    }

    public function test_store_rejects_absolute_record_id(): void
    {
        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => '/etc',
            'operation' => 'thumbnail',
            'sourcePath' => 'archive/source.mov',
        ], $this->authHeaders());

        $response->assertUnprocessable();
    }

    public function test_store_rejects_traversal_montage_clip_path(): void
    {
        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-traversal-3',
            'operation' => 'montage_export',
            'options' => [
                'clips' => [
                    ['path' => '../../../../etc/passwd', 'inSec' => 0, 'outSec' => 5],
                ],
            ],
        ], $this->authHeaders());

        $response->assertUnprocessable();
        $this->assertDatabaseMissing('media_jobs', ['record_id' => 'media-record-traversal-3']);
    }

    public function test_store_rejects_traversal_watermark_path(): void
    {
        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-traversal-4',
            'operation' => 'transcode',
            'sourcePath' => 'archive/source.mov',
            'options' => [
                'watermark' => ['path' => '../../.env', 'enabled' => true],
            ],
        ], $this->authHeaders());

        $response->assertUnprocessable();
        $this->assertDatabaseMissing('media_jobs', ['record_id' => 'media-record-traversal-4']);
    }

    public function test_store_accepts_safe_relative_paths(): void
    {
        $response = $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'media-record-safe-1',
            'operation' => 'thumbnail',
            'sourcePath' => 'archive/source.mov',
        ], $this->authHeaders());

        $response->assertAccepted();
        $this->assertDatabaseHas('media_jobs', ['record_id' => 'media-record-safe-1']);
    }

    // -- ownership: show/cancel/index ----------------------------------------

    public function test_show_returns_404_for_another_users_job(): void
    {
        $ownerId = $this->authenticatedUserId();
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-owned-1',
            'record_id' => 'media-record-owned-1',
            'created_by' => $ownerId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->getJson('/api/v1/media/jobs/'.$mediaJob->id, $this->otherViewerHeaders())
            ->assertNotFound();
    }

    public function test_show_allows_the_owner(): void
    {
        $ownerId = $this->authenticatedUserId();
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-owned-2',
            'record_id' => 'media-record-owned-2',
            'created_by' => $ownerId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->getJson('/api/v1/media/jobs/'.$mediaJob->id, $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('job.id', 'media-job-owned-2');
    }

    public function test_show_allows_admin_to_view_another_users_job(): void
    {
        $ownerId = $this->authenticatedUserId();
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-owned-3',
            'record_id' => 'media-record-owned-3',
            'created_by' => $ownerId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->getJson('/api/v1/media/jobs/'.$mediaJob->id, $this->adminOverrideHeaders())
            ->assertOk()
            ->assertJsonPath('job.id', 'media-job-owned-3');
    }

    public function test_cancel_returns_404_for_another_users_job(): void
    {
        $ownerId = $this->authenticatedUserId();
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-owned-4',
            'record_id' => 'media-record-owned-4',
            'created_by' => $ownerId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->postJson('/api/v1/media/jobs/'.$mediaJob->id.'/cancel', [], $this->otherViewerHeaders())
            ->assertNotFound();

        $this->assertSame('queued', $mediaJob->refresh()->status);
    }

    public function test_cancel_allows_the_owner(): void
    {
        $ownerId = $this->authenticatedUserId();
        $mediaJob = MediaJob::query()->create([
            'id' => 'media-job-owned-5',
            'record_id' => 'media-record-owned-5',
            'created_by' => $ownerId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $this->postJson('/api/v1/media/jobs/'.$mediaJob->id.'/cancel', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('job.status', 'canceled');
    }

    public function test_index_only_lists_own_jobs_for_non_admin(): void
    {
        $ownerId = $this->authenticatedUserId();
        $otherId = $this->otherViewerId();

        MediaJob::query()->create([
            'id' => 'media-job-idx-mine',
            'record_id' => 'media-record-idx-mine',
            'created_by' => $ownerId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-idx-theirs',
            'record_id' => 'media-record-idx-theirs',
            'created_by' => $otherId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/media/jobs', $this->authHeaders())->assertOk();
        $ids = array_column($response->json('jobs'), 'id');

        $this->assertContains('media-job-idx-mine', $ids);
        $this->assertNotContains('media-job-idx-theirs', $ids);
    }

    public function test_index_lists_all_jobs_for_admin(): void
    {
        $ownerId = $this->authenticatedUserId();
        $otherId = $this->otherViewerId();

        MediaJob::query()->create([
            'id' => 'media-job-idx-admin-1',
            'record_id' => 'media-record-idx-admin-1',
            'created_by' => $ownerId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        MediaJob::query()->create([
            'id' => 'media-job-idx-admin-2',
            'record_id' => 'media-record-idx-admin-2',
            'created_by' => $otherId,
            'operation' => 'thumbnail',
            'status' => 'queued',
            'queued_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/media/jobs', $this->adminOverrideHeaders())->assertOk();
        $ids = array_column($response->json('jobs'), 'id');

        $this->assertContains('media-job-idx-admin-1', $ids);
        $this->assertContains('media-job-idx-admin-2', $ids);
    }

    // -- processor-level defense in depth ------------------------------------

    /**
     * Even if a malicious row reaches the processor directly (bypassing
     * store()'s validation — e.g. a legacy row, or a future caller that
     * forgets to validate), RealMediaProcessor must still refuse to read
     * outside the storage root, and must never issue the OCR HTTP call.
     */
    public function test_processor_refuses_traversal_source_path_and_never_calls_ocr_service(): void
    {
        Http::fake();

        $root = sys_get_temp_dir().'/media-containment-test-'.uniqid();
        mkdir($root, 0777, true);
        $pathGuard = new MediaPathGuard($root);

        $runner = new FakeProcessRunner();
        $transcriber = new WhisperTranscriber($runner, 'whisper-ctranslate2', 'large-v3', 'ar', 'vtt');
        $processor = new RealMediaProcessor(
            $runner,
            $transcriber,
            'ffmpeg',
            'ffprobe',
            [],
            new OcrClient('http://ocr-test:8788'),
            null,
            $pathGuard,
        );

        $job = new MediaJob();
        $job->id = 'job-malicious-ocr';
        $job->record_id = 'malicious-record';
        $job->operation = 'ocr';
        $job->source_path = '../../../../etc/passwd';
        $job->options = [];

        try {
            $this->expectException(\RuntimeException::class);
            $processor->process($job);
        } finally {
            Http::assertNothingSent();
            $this->assertSame([], $runner->lastCommand());
            rmdir($root);
        }
    }

    /**
     * Same guarantee for the ffmpeg-driven thumbnail path: the command is
     * never built/run when the source path escapes the storage root.
     */
    public function test_processor_refuses_absolute_source_path_for_thumbnail(): void
    {
        $root = sys_get_temp_dir().'/media-containment-test-'.uniqid();
        mkdir($root, 0777, true);
        $pathGuard = new MediaPathGuard($root);

        $runner = new FakeProcessRunner();
        $transcriber = new WhisperTranscriber($runner, 'whisper-ctranslate2', 'large-v3', 'ar', 'vtt');
        $processor = new RealMediaProcessor($runner, $transcriber, 'ffmpeg', 'ffprobe', [], null, null, $pathGuard);

        $job = new MediaJob();
        $job->id = 'job-malicious-thumb';
        $job->record_id = 'malicious-record';
        $job->operation = 'thumbnail';
        $job->source_path = '/etc/passwd';
        $job->options = [];

        try {
            $this->expectException(\RuntimeException::class);
            $processor->process($job);
        } finally {
            $this->assertSame([], $runner->lastCommand());
            rmdir($root);
        }
    }

    // -- helpers --------------------------------------------------------------

    private function authenticatedUserId(): string
    {
        $this->authHeaders();

        return (string) User::query()->where('email', 'admin@example.test')->firstOrFail()->getKey();
    }

    /**
     * @return array<string, string>
     */
    private function otherViewerHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->tokenFor($this->otherViewerUser())];
    }

    private function otherViewerId(): string
    {
        return (string) $this->otherViewerUser()->getKey();
    }

    private function otherViewerUser(): User
    {
        return User::query()->firstOrCreate(
            ['email' => 'other-viewer@example.test'],
            [
                'name' => 'Other Viewer',
                'password' => Hash::make('secret-password'),
                'role' => 'viewer',
            ],
        );
    }

    /**
     * @return array<string, string>
     */
    private function adminOverrideHeaders(): array
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'media-job-admin@example.test'],
            [
                'name' => 'Media Job Admin',
                'password' => Hash::make('secret-password'),
                'role' => 'admin',
            ],
        );

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    private function tokenFor(User $user): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return $login->json('accessToken');
    }
}
