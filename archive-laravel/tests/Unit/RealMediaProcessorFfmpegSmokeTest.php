<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\MediaJob;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\SymfonyProcessRunner;
use App\Services\Media\WhisperTranscriber;
use PHPUnit\Framework\TestCase;

/**
 * V3-MEDIA-006 real-binary smoke test. Every other RealMediaProcessor test
 * (RealMediaProcessorTest) uses FakeProcessRunner, which never actually
 * invokes ffmpeg -- it just reports success. This class instead runs the
 * genuine `ffmpeg`/`ffprobe` binaries via SymfonyProcessRunner (the same
 * runner production uses) against a real, tiny source video, to confirm the
 * derivative ffmpeg commands are actually correct, not just shaped
 * correctly for a fake.
 *
 * The source video is synthesized by ffmpeg itself (lavfi testsrc + sine),
 * not a committed binary fixture: the repo has no existing ffmpeg test
 * fixture asset to reuse (checked -- none of the media test suites ship
 * one), and generating a couple of seconds of video via ffmpeg's own
 * generators is both smaller and more portable than adding one.
 *
 * Skips (does not fail) when ffmpeg/ffprobe are not on PATH, so this stays
 * safe to run outside the Docker test image (archive-laravel/Dockerfile.worker
 * installs ffmpeg; scripts/laravel-docker.mjs runs tests through it).
 */
class RealMediaProcessorFfmpegSmokeTest extends TestCase
{
    private const RECORD_ID = 'ffmpeg-smoke-record';

    private const SOURCE_DIR = 'ffmpeg-smoke-source';

    private RealMediaProcessor $processor;

    private string $sourcePath;

    protected function setUp(): void
    {
        parent::setUp();

        if (! self::binaryAvailable('ffmpeg') || ! self::binaryAvailable('ffprobe')) {
            self::markTestSkipped('ffmpeg/ffprobe are not on PATH -- this smoke test only runs where the real binaries are installed (see archive-laravel/Dockerfile.worker).');
        }

        $runner = new SymfonyProcessRunner(60);
        $transcriber = new WhisperTranscriber($runner);
        $this->processor = new RealMediaProcessor($runner, $transcriber, 'ffmpeg', 'ffprobe');

        @mkdir(self::SOURCE_DIR, 0777, true);
        $this->sourcePath = self::SOURCE_DIR.'/source.mp4';

        // A real ~1s, tiny (128x128) MP4 with a video and an audio stream,
        // synthesized entirely by ffmpeg's own lavfi generators -- no
        // external asset needed. `-shortest` keeps it exactly 1s once the
        // sine tone (also 1s) is exhausted. 128px (not 64) so the proxy
        // test below, which requests the smallest maxWidth the API allows
        // (64 -- see MediaDerivativesController's settings.maxWidth min:64
        // and RealMediaProcessor::processDerivativeProxy()'s matching
        // floor), can actually observe a real downscale instead of a no-op.
        $result = $runner->run([
            'ffmpeg', '-y',
            '-f', 'lavfi', '-i', 'testsrc=duration=1:size=128x128:rate=5',
            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
            '-shortest',
            $this->sourcePath,
        ]);

        if ($result['exitCode'] !== 0 || ! is_file($this->sourcePath)) {
            self::markTestSkipped("Could not synthesize the ffmpeg test source: {$result['stderr']}");
        }
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        $this->removeDirectory(self::RECORD_ID);
        $this->removeDirectory(self::SOURCE_DIR);
    }

    public function test_real_ffmpeg_generates_a_valid_thumbnail_jpeg(): void
    {
        $job = $this->makeJob('thumbnail', 'smoke-thumb', ['atSec' => 0]);

        $artifacts = $this->processor->process($job);

        $this->assertSame('derivative_thumbnail', $artifacts[0]['kind']);
        $outputPath = self::RECORD_ID.'/derivatives/smoke-thumb.jpg';
        $this->assertFileExists($outputPath);
        $this->assertFileDoesNotExist(
            self::RECORD_ID.'/derivatives/.tmp-smoke-thumb.jpg',
            'staged temp file must be promoted, not left behind'
        );

        $bytes = (string) file_get_contents($outputPath);
        $this->assertGreaterThan(100, strlen($bytes), 'a real JPEG frame should be well over 100 bytes');
        // JPEG magic number (SOI marker) -- confirms ffmpeg actually wrote a
        // decodable image, not just some non-empty bytes.
        $this->assertSame("\xFF\xD8", substr($bytes, 0, 2));
    }

    public function test_real_ffmpeg_generates_a_valid_waveform_png(): void
    {
        $job = $this->makeJob('waveform', 'smoke-waveform', ['width' => 320, 'height' => 80, 'color' => '3B82F6']);

        $artifacts = $this->processor->process($job);

        $this->assertSame('derivative_waveform', $artifacts[0]['kind']);
        $outputPath = self::RECORD_ID.'/derivatives/smoke-waveform.png';
        $this->assertFileExists($outputPath);

        $bytes = (string) file_get_contents($outputPath);
        // PNG magic number.
        $this->assertSame("\x89PNG\r\n\x1a\n", substr($bytes, 0, 8));
    }

    public function test_real_ffmpeg_generates_a_valid_proxy_mp4_verified_by_ffprobe(): void
    {
        // 64 is the smallest maxWidth the API/processor actually allow
        // (both enforce a floor of 64) -- the 128px source above makes this
        // a real downscale, not a no-op at the source's own width.
        $job = $this->makeJob('proxy', 'smoke-proxy', ['maxWidth' => 64, 'videoBitrateKbps' => 200]);

        $artifacts = $this->processor->process($job);

        $this->assertSame('derivative_proxy', $artifacts[0]['kind']);
        $this->assertSame('libx264', $artifacts[0]['encoder']);
        $outputPath = self::RECORD_ID.'/derivatives/smoke-proxy.mp4';
        $this->assertFileExists($outputPath);

        // Real verification via ffprobe (not a size/magic-number guess):
        // asks ffprobe to actually decode the container and report the
        // video stream's width. If ffmpeg's proxy command were wrong (bad
        // filter syntax, wrong codec flags, etc.), this is what would catch
        // it -- ffprobe would fail to parse a corrupt/empty file.
        $runner = new SymfonyProcessRunner(30);
        $probe = $runner->run([
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,codec_type',
            '-of', 'csv=p=0',
            $outputPath,
        ]);

        $this->assertSame(0, $probe['exitCode'], "ffprobe could not read the generated proxy: {$probe['stderr']}");
        $this->assertStringContainsString('video', $probe['stdout']);
        // scale=min(64\,iw):-2 on the 128px-wide source should land at 64.
        $this->assertStringContainsString('64', $probe['stdout']);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function makeJob(string $type, string $derivativeId, array $settings): MediaJob
    {
        $job = new MediaJob;
        $job->id = "job-{$derivativeId}";
        $job->record_id = self::RECORD_ID;
        $job->operation = 'derivative';
        $job->source_path = $this->sourcePath;
        $job->options = [
            'derivativeId' => $derivativeId,
            'derivativeType' => $type,
            'settings' => $settings,
        ];

        return $job;
    }

    private static function binaryAvailable(string $binary): bool
    {
        $command = DIRECTORY_SEPARATOR === '\\' ? "where {$binary} 2>NUL" : "command -v {$binary} 2>/dev/null";
        exec($command, $output, $exitCode);

        return $exitCode === 0;
    }

    private function removeDirectory(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }

        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $path = "{$dir}/{$entry}";
            if (is_dir($path)) {
                $this->removeDirectory($path);

                continue;
            }

            @unlink($path);
        }
        @rmdir($dir);
    }
}
