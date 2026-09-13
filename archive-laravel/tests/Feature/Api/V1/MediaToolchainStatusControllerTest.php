<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1;

use App\Models\User;
use App\Services\Media\ProcessRunner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Covers the independent media-operations toolchain status panel
 * (.stitch/SYSTEM_COVERAGE.md's "لم يُنفَّذ بعد" gap): each of ffmpeg,
 * ffprobe, whisper, reverb, gpu, and connectors must report one of
 * available/needs_configuration/stopped, derived from real configuration.
 */
class MediaToolchainStatusControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The service caches its snapshot for 60s; each test wants a fresh probe.
        Cache::flush();
    }

    /** Binds a ProcessRunner whose per-binary exit code/stdout is fully controllable. */
    private function bindProcessRunner(array $responsesByFirstArg, ?array $fallback = null): void
    {
        $this->app->bind(ProcessRunner::class, fn () => new class($responsesByFirstArg, $fallback) implements ProcessRunner
        {
            public function __construct(
                private readonly array $responsesByFirstArg,
                private readonly ?array $fallback,
            ) {}

            public function run(array $command, ?callable $onProgress = null, ?callable $isCanceled = null): array
            {
                $binary = $command[0] ?? '';

                return $this->responsesByFirstArg[$binary]
                    ?? $this->fallback
                    ?? ['exitCode' => 0, 'stdout' => '', 'stderr' => ''];
            }
        });
    }

    private function viewer(): User
    {
        return User::factory()->create(['role' => 'viewer']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/system/media-toolchain')->assertUnauthorized();
    }

    public function test_authenticated_viewer_may_read_the_panel(): void
    {
        config(['media.processor' => 'fake']);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure([
                'checkedAt',
                'components' => [
                    '*' => ['key', 'status', 'detail'],
                ],
            ]);

        $keys = array_column($response->json('components'), 'key');
        $this->assertSame(['ffmpeg', 'ffprobe', 'whisper', 'reverb', 'gpu', 'connectors'], $keys);
    }

    public function test_ffmpeg_ffprobe_and_whisper_need_configuration_when_media_processing_is_disabled(): void
    {
        config(['media.processor' => 'fake']);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('needs_configuration', $byKey['ffmpeg']['status']);
        $this->assertSame('needs_configuration', $byKey['ffprobe']['status']);
        $this->assertSame('needs_configuration', $byKey['whisper']['status']);
    }

    public function test_ffmpeg_and_ffprobe_are_available_when_media_processing_is_real_and_binaries_probe_successfully(): void
    {
        config([
            'media.processor' => 'real',
            'media.ffmpeg_path' => 'ffmpeg',
            'media.ffprobe_path' => 'ffprobe',
            'media.whisper_binary' => 'whisper-ctranslate2',
        ]);
        $this->bindProcessRunner([
            'ffmpeg' => ['exitCode' => 0, 'stdout' => 'ffmpeg version 6.0', 'stderr' => ''],
            'ffprobe' => ['exitCode' => 0, 'stdout' => 'ffprobe version 6.0', 'stderr' => ''],
            'whisper-ctranslate2' => ['exitCode' => 0, 'stdout' => 'usage: whisper-ctranslate2', 'stderr' => ''],
        ]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('available', $byKey['ffmpeg']['status']);
        $this->assertSame('available', $byKey['ffprobe']['status']);
        $this->assertSame('available', $byKey['whisper']['status']);
    }

    public function test_ffmpeg_is_stopped_when_media_processing_is_real_but_the_binary_is_not_runnable(): void
    {
        config([
            'media.processor' => 'real',
            'media.ffmpeg_path' => 'ffmpeg',
            'media.ffprobe_path' => 'ffprobe',
            'media.whisper_binary' => 'whisper-ctranslate2',
        ]);
        $this->bindProcessRunner([
            'ffmpeg' => ['exitCode' => 127, 'stdout' => '', 'stderr' => 'command not found'],
        ], fallback: ['exitCode' => 0, 'stdout' => 'ok', 'stderr' => '']);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('stopped', $byKey['ffmpeg']['status']);
        $this->assertSame('available', $byKey['ffprobe']['status']);
    }

    public function test_reverb_is_stopped_when_the_broadcast_driver_is_not_reverb(): void
    {
        config(['broadcasting.default' => 'log']);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('stopped', $byKey['reverb']['status']);
    }

    public function test_reverb_needs_configuration_when_selected_but_missing_app_credentials(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => '',
            'broadcasting.connections.reverb.secret' => '',
            'broadcasting.connections.reverb.app_id' => '',
        ]);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('needs_configuration', $byKey['reverb']['status']);
    }

    public function test_reverb_is_available_when_selected_with_complete_app_credentials(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'archive-collab-key',
            'broadcasting.connections.reverb.secret' => 'secret',
            'broadcasting.connections.reverb.app_id' => 'app-1',
        ]);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('available', $byKey['reverb']['status']);
    }

    public function test_gpu_is_stopped_when_whisper_device_is_cpu(): void
    {
        config(['media.whisper_device' => 'cpu']);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('stopped', $byKey['gpu']['status']);
    }

    public function test_gpu_needs_configuration_when_cuda_is_selected_but_no_gpu_is_visible(): void
    {
        config(['media.whisper_device' => 'cuda']);
        $this->bindProcessRunner([
            'nvidia-smi' => ['exitCode' => 1, 'stdout' => '', 'stderr' => 'no devices found'],
        ]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('needs_configuration', $byKey['gpu']['status']);
    }

    public function test_gpu_is_available_when_cuda_is_selected_and_a_gpu_is_visible(): void
    {
        config(['media.whisper_device' => 'cuda']);
        $this->bindProcessRunner([
            'nvidia-smi' => ['exitCode' => 0, 'stdout' => 'NVIDIA Test GPU', 'stderr' => ''],
        ]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('available', $byKey['gpu']['status']);
    }

    public function test_connectors_need_configuration_when_ingest_transport_is_the_fake_default(): void
    {
        config(['ingest.transport' => 'fake']);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('needs_configuration', $byKey['connectors']['status']);
    }

    public function test_connectors_are_available_when_ftp_transport_is_fully_configured(): void
    {
        config([
            'ingest.transport' => 'ftp',
            'ingest.ftp.host' => 'ftp.example.test',
            'ingest.ftp.user' => 'archive',
            'ingest.ftp.password' => 'secret',
        ]);
        $this->bindProcessRunner([]);

        $response = $this->actingAs($this->viewer())->getJson('/api/v1/system/media-toolchain');
        $byKey = $this->componentsByKey($response);

        $this->assertSame('available', $byKey['connectors']['status']);
    }

    private function componentsByKey($response): array
    {
        return collect($response->json('components'))->keyBy('key')->all();
    }
}
