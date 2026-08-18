<?php

namespace Tests\Unit;

use App\Exceptions\GpuUnavailableException;
use App\Models\MediaJob;
use App\Services\Media\AudioPreprocessor;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\FfmpegProgressParser;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\WhisperTranscriber;
use PHPUnit\Framework\TestCase;

class RealMediaProcessorTest extends TestCase
{
    private FakeProcessRunner $runner;

    private RealMediaProcessor $processor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->runner = new FakeProcessRunner;
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'whisper-ctranslate2',
            'large-v3',
            'ar',
            'vtt'
        );
        $this->processor = new RealMediaProcessor($this->runner, $transcriber, 'ffmpeg', 'ffprobe');

        // Create mock output directories for fake process tests
        @mkdir('record-1', 0777, true);
        @mkdir('record-2', 0777, true);
        @mkdir('record-3', 0777, true);
        @mkdir('record-watermark', 0777, true);
        @mkdir('record-whisper', 0777, true);

        // Create mock output files for thumbnails and transcoding
        file_put_contents('record-1/thumb.jpg', 'mock image');
        file_put_contents('record-2/thumb.jpg', 'mock image');
        file_put_contents('record-1/transcoded.mp4', 'mock video');
        file_put_contents('record-2/transcoded.mp4', 'mock video');
        file_put_contents('record-watermark/transcoded.mp4', 'mock video');

        // Create mock audio extraction and transcript files
        file_put_contents('record-3/audio_extracted.wav', 'mock audio');
        file_put_contents('record-3/transcript.srt', "1\n00:00:00,000 --> 00:00:01,000\nMock subtitle\n");
        file_put_contents('record-3/transcript.vtt', "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nMock subtitle\n");
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        // Clean up mock directories
        $this->removeMockDirectory('record-1');
        $this->removeMockDirectory('record-2');
        $this->removeMockDirectory('record-3');
        $this->removeMockDirectory('record-watermark');
        $this->removeMockDirectory('record-whisper');
        $this->removeMockDirectory('record-segmented');
        $this->removeMockDirectory('record-derivative');
    }

    private function removeMockDirectory(string $dir): void
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
                $this->removeMockDirectory($path);

                continue;
            }

            @unlink($path);
        }
        @rmdir($dir);
    }

    public function test_thumbnail_builds_correct_command(): void
    {
        $job = new MediaJob;
        $job->id = 'job-1';
        $job->record_id = 'record-1';
        $job->operation = 'thumbnail';
        $job->source_path = 'archive/source.mov';
        $job->options = ['atSec' => 5];

        $artifacts = $this->processor->process($job);

        $this->assertCount(1, $artifacts);
        $this->assertSame('thumbnail', $artifacts[0]['kind']);
        $this->assertStringContainsString('record-1/thumb.jpg', $artifacts[0]['key']);
    }

    public function test_transcode_builds_correct_command(): void
    {
        $job = new MediaJob;
        $job->id = 'job-2';
        $job->record_id = 'record-2';
        $job->operation = 'transcode';
        $job->source_path = 'archive/source.mov';
        $job->options = [];

        $artifacts = $this->processor->process($job);

        $this->assertCount(1, $artifacts);
        $this->assertSame('video', $artifacts[0]['kind']);
        $this->assertStringContainsString('record-2/transcoded.mp4', $artifacts[0]['key']);
    }

    public function test_transcode_can_apply_watermark_overlay_from_job_options(): void
    {
        $job = new MediaJob;
        $job->id = 'job-watermark';
        $job->record_id = 'record-watermark';
        $job->operation = 'transcode';
        $job->source_path = 'archive/source.mov';
        $job->options = [
            'watermark' => [
                'path' => 'branding/archive-logo.png',
                'position' => 'top-right',
                'opacity' => 0.6,
                'margin' => 18,
            ],
        ];

        $artifacts = $this->processor->process($job);
        $command = $this->runner->lastCommand();
        $filterIndex = array_search('-filter_complex', $command, true);

        $this->assertCount(1, $artifacts);
        $this->assertSame('video', $artifacts[0]['kind']);
        // Client-supplied watermark paths are contained (V1-111): the command
        // carries the resolved absolute path, not the raw client string.
        $watermarkArg = current(array_filter($command, fn ($arg): bool => is_string($arg) && str_ends_with($arg, 'branding/archive-logo.png')));
        $this->assertNotFalse($watermarkArg);
        $this->assertNotFalse($filterIndex);
        $this->assertSame(
            '[1:v]format=rgba,colorchannelmixer=aa=0.6[wm];[0:v][wm]overlay=x=W-w-18:y=18[v]',
            $command[$filterIndex + 1]
        );
        $this->assertContains('[v]', $command);
        $this->assertContains('0:a?', $command);
    }

    public function test_transcode_uses_default_watermark_when_enabled_in_processor_config(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'whisper-ctranslate2',
            'large-v3',
            'ar',
            'vtt'
        );
        $processor = new RealMediaProcessor(
            $this->runner,
            $transcriber,
            'ffmpeg',
            'ffprobe',
            [
                'enabled' => true,
                'path' => 'branding/default-watermark.png',
                'position' => 'bottom-left',
                'opacity' => 0.75,
                'margin' => 12,
            ],
        );

        $job = new MediaJob;
        $job->id = 'job-watermark-default';
        $job->record_id = 'record-watermark-default';
        $job->operation = 'transcode';
        $job->source_path = 'archive/source.mov';
        $job->options = [];

        $processor->process($job);
        $command = $this->runner->lastCommand();
        $filterIndex = array_search('-filter_complex', $command, true);

        $this->assertContains('branding/default-watermark.png', $command);
        $this->assertNotFalse($filterIndex);
        $this->assertSame(
            '[1:v]format=rgba,colorchannelmixer=aa=0.75[wm];[0:v][wm]overlay=x=12:y=H-h-12[v]',
            $command[$filterIndex + 1]
        );
    }

    public function test_transcription_builds_correct_command(): void
    {
        $job = new MediaJob;
        $job->id = 'job-3';
        $job->record_id = 'record-3';
        $job->operation = 'transcription';
        $job->source_path = 'archive/audio.mp3';
        $job->options = [];

        $artifacts = $this->processor->process($job);

        $this->assertCount(3, $artifacts);
        $kinds = array_column($artifacts, 'kind');
        $this->assertContains('transcript_srt', $kinds);
        $this->assertContains('transcript_vtt', $kinds);
        $this->assertContains('transcript_ttml', $kinds);
    }

    public function test_segmented_transcription_merges_local_timestamps_using_each_segment_start(): void
    {
        $preprocessor = new class($this->runner) extends AudioPreprocessor
        {
            public function __construct(FakeProcessRunner $runner)
            {
                parent::__construct($runner);
            }

            public function extractAudio(string $sourcePath, string $recordId): string
            {
                @mkdir($recordId, 0777, true);
                $path = "{$recordId}/audio_extracted.wav";
                file_put_contents($path, 'audio');

                return $path;
            }

            public function planSegments(string $audioPath): array
            {
                return [
                    ['startSec' => 0.0, 'endSec' => 120.0, 'durationSec' => 120.0],
                    ['startSec' => 120.0, 'endSec' => 240.0, 'durationSec' => 120.0],
                ];
            }

            public function extractSegment(string $audioPath, string $recordId, int $segmentIndex, float $startSec, float $endSec): string
            {
                $path = "{$recordId}/segment_{$segmentIndex}.wav";
                file_put_contents($path, 'segment');

                return $path;
            }
        };

        $transcriber = new class($this->runner) extends WhisperTranscriber
        {
            public function __construct(FakeProcessRunner $runner)
            {
                parent::__construct($runner);
            }

            public function transcribe(string $inputPath, string $recordId, array $jobOptions = []): array
            {
                if (! is_dir($recordId)) {
                    mkdir($recordId, 0777, true);
                }
                $label = str_ends_with($recordId, '/segments/0') ? 'First segment' : 'Second segment';
                $srt = "1\n00:00:01,000 --> 00:00:02,500\n{$label}\n";
                $vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n{$label}\n";
                $ttml = "<?xml version=\"1.0\"?><tt><body><div><p begin=\"00:00:01.000\" end=\"00:00:02.500\">{$label}</p></div></body></tt>";

                file_put_contents("{$recordId}/transcript.srt", $srt);
                file_put_contents("{$recordId}/transcript.vtt", $vtt);
                file_put_contents("{$recordId}/transcript.ttml", $ttml);

                return [
                    ['kind' => 'transcript_srt', 'key' => "{$recordId}/transcript.srt", 'url' => null],
                    ['kind' => 'transcript_vtt', 'key' => "{$recordId}/transcript.vtt", 'url' => null],
                    ['kind' => 'transcript_ttml', 'key' => "{$recordId}/transcript.ttml", 'url' => null],
                ];
            }
        };

        $processor = new RealMediaProcessor($this->runner, $transcriber, audioPreprocessor: $preprocessor);
        $job = new MediaJob;
        $job->id = 'job-segmented';
        $job->record_id = 'record-segmented';
        $job->operation = 'transcription';
        $job->source_path = 'archive/long-audio.mp3';
        $job->options = ['outputFormats' => ['srt', 'vtt', 'ttml']];

        $processor->process($job);

        $srt = (string) file_get_contents('record-segmented/transcript.srt');
        $vtt = (string) file_get_contents('record-segmented/transcript.vtt');
        $ttml = (string) file_get_contents('record-segmented/transcript.ttml');

        $this->assertStringContainsString('00:02:01,000 --> 00:02:02,500', $srt);
        $this->assertStringContainsString('00:02:01.000 --> 00:02:02.500', $vtt);
        $this->assertStringContainsString('begin="00:02:01.000" end="00:02:02.500"', $ttml);
        $this->assertSame(1, substr_count($vtt, 'WEBVTT'));
        $this->assertSame(1, substr_count($ttml, '<tt'));
    }

    public function test_throws_on_non_zero_exit_code(): void
    {
        $this->runner->setResponse('thumbnail', [
            'exitCode' => 1,
            'stdout' => '',
            'stderr' => 'Error: invalid input',
        ]);

        $job = new MediaJob;
        $job->id = 'job-fail';
        $job->record_id = 'record-fail';
        $job->operation = 'thumbnail';
        $job->source_path = 'archive/missing.mov';
        $job->options = [];

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/ffmpeg thumbnail failed/');

        $this->processor->process($job);
    }

    public function test_returns_artifact_with_null_url(): void
    {
        $job = new MediaJob;
        $job->id = 'job-4';
        $job->record_id = 'record-4';
        $job->operation = 'thumbnail';
        $job->source_path = 'archive/source.mov';
        $job->options = [];

        $artifacts = $this->processor->process($job);

        $this->assertNull($artifacts[0]['url']);
    }

    /**
     * V3-PERF-005: a retried attempt (fixed output key, e.g. "record-1/thumb.jpg")
     * must overwrite cleanly rather than fail against a leftover partial file
     * from the earlier attempt -- ffmpeg needs -y for that.
     */
    public function test_thumbnail_command_includes_the_overwrite_flag_for_idempotent_retries(): void
    {
        $job = new MediaJob;
        $job->id = 'job-idempotent-thumb';
        $job->record_id = 'record-1';
        $job->operation = 'thumbnail';
        $job->source_path = 'archive/source.mov';
        $job->options = [];

        $this->processor->process($job);

        $this->assertContains('-y', $this->runner->lastCommand());
    }

    public function test_transcode_command_includes_the_overwrite_flag_for_idempotent_retries(): void
    {
        $job = new MediaJob;
        $job->id = 'job-idempotent-transcode';
        $job->record_id = 'record-2';
        $job->operation = 'transcode';
        $job->source_path = 'archive/source.mov';
        $job->options = [];

        $this->processor->process($job);

        $this->assertContains('-y', $this->runner->lastCommand());
    }

    public function test_ignores_unknown_operation(): void
    {
        $job = new MediaJob;
        $job->id = 'job-unknown';
        $job->record_id = 'record-unknown';
        $job->operation = 'unknown_op';
        $job->options = [];

        $artifacts = $this->processor->process($job);

        $this->assertEmpty($artifacts);
    }

    // NOTE: these three were previously misplaced inside FfmpegProgressParserTest
    // below, where `$this->processor`/`$this->runner` don't exist (undefined
    // property -> fatal error on every run). Moved here, where setUp()
    // actually defines them, while touching this file for V3-PERF-005.
    public function test_montage_export_concatenates_clips(): void
    {
        $job = new MediaJob;
        $job->id = 'job-montage-1';
        $job->record_id = 'record-montage-1';
        $job->operation = 'montage_export';
        $job->options = [
            'clips' => [
                ['path' => 'archive/clip-a.mp4', 'inSec' => 0, 'outSec' => 5],
                ['path' => 'archive/clip-b.mp4', 'inSec' => 2, 'outSec' => 9],
            ],
        ];

        $artifacts = $this->processor->process($job);

        $this->assertCount(1, $artifacts);
        $this->assertSame('montage_mp4', $artifacts[0]['kind']);
        $this->assertStringContainsString('record-montage-1/montage.mp4', $artifacts[0]['key']);
    }

    public function test_montage_export_commands_include_the_overwrite_flag_for_idempotent_retries(): void
    {
        $job = new MediaJob;
        $job->id = 'job-montage-idempotent';
        $job->record_id = 'record-montage-idempotent';
        $job->operation = 'montage_export';
        $job->options = [
            'clips' => [
                ['path' => 'archive/clip-a.mp4', 'inSec' => 0, 'outSec' => 5],
            ],
        ];

        $this->processor->process($job);

        // Both the per-clip trim and the final concat are fixed-key ffmpeg
        // writes; the concat command is the last one the fake runner saw.
        $this->assertContains('-y', $this->runner->lastCommand());
    }

    public function test_montage_export_requires_clips(): void
    {
        $job = new MediaJob;
        $job->id = 'job-montage-2';
        $job->record_id = 'record-montage-2';
        $job->operation = 'montage_export';
        $job->options = ['clips' => []];

        $this->expectException(\RuntimeException::class);
        $this->processor->process($job);
    }

    // V3-MEDIA-006: derivative generation (thumbnail/waveform/proxy). Like
    // the pre-existing thumbnail/transcode tests above, FakeProcessRunner
    // never actually writes a file -- it only reports success -- so these
    // pre-create the *staged temp* file (RealMediaProcessor writes ffmpeg's
    // output there, then rename()s it onto the final key on success) rather
    // than the final key directly, to exercise the real stage-then-promote
    // path instead of bypassing it.

    private function stageDerivativeFixture(string $recordId, string $derivativeId, string $extension, string $content = 'mock derivative'): void
    {
        @mkdir("{$recordId}/derivatives", 0777, true);
        // Matches RealMediaProcessor::stageDerivativeOutput()'s
        // ".tmp-{basename}" infix (not a ".ext.tmp" suffix) -- the real
        // extension has to stay last or ffmpeg can't infer the output
        // format (see RealMediaProcessorFfmpegSmokeTest).
        file_put_contents("{$recordId}/derivatives/.tmp-{$derivativeId}.{$extension}", $content);
    }

    public function test_derivative_thumbnail_stages_then_promotes_to_the_final_key(): void
    {
        $this->stageDerivativeFixture('record-derivative', 'deriv-thumb-1', 'jpg');

        $job = new MediaJob;
        $job->id = 'job-derivative-thumb';
        $job->record_id = 'record-derivative';
        $job->operation = 'derivative';
        $job->source_path = 'archive/source.mov';
        $job->options = [
            'derivativeId' => 'deriv-thumb-1',
            'derivativeType' => 'thumbnail',
            'settings' => ['atSec' => 3],
        ];

        $artifacts = $this->processor->process($job);

        $this->assertSame('derivative_thumbnail', $artifacts[0]['kind']);
        $this->assertSame('record-derivative/derivatives/deriv-thumb-1.jpg', $artifacts[0]['key']);
        // Promoted: final file exists, staged temp file is gone.
        $this->assertFileExists('record-derivative/derivatives/deriv-thumb-1.jpg');
        $this->assertFileDoesNotExist('record-derivative/derivatives/.tmp-deriv-thumb-1.jpg');

        $command = $this->runner->lastCommand();
        $this->assertContains('-y', $command);
        $ssIndex = array_search('-ss', $command, true);
        $this->assertSame('3', $command[$ssIndex + 1]);
    }

    public function test_derivative_waveform_builds_a_showwavespic_command_with_sanitized_color(): void
    {
        $this->stageDerivativeFixture('record-derivative', 'deriv-wave-1', 'png');

        $job = new MediaJob;
        $job->id = 'job-derivative-wave';
        $job->record_id = 'record-derivative';
        $job->operation = 'derivative';
        $job->source_path = 'archive/source.wav';
        $job->options = [
            'derivativeId' => 'deriv-wave-1',
            'derivativeType' => 'waveform',
            // Deliberately not a clean 6-hex-digit value -- must be
            // sanitized rather than interpolated as-is into the ffmpeg
            // filtergraph string.
            'settings' => ['width' => 640, 'height' => 120, 'color' => 'not-a-color!!'],
        ];

        $artifacts = $this->processor->process($job);

        $this->assertSame('derivative_waveform', $artifacts[0]['kind']);
        $this->assertFileExists('record-derivative/derivatives/deriv-wave-1.png');

        $command = $this->runner->lastCommand();
        $filterIndex = array_search('-filter_complex', $command, true);
        $this->assertNotFalse($filterIndex);
        // Unsanitizable input falls back to the safe default color rather
        // than smuggling the invalid characters into the command.
        $this->assertSame('showwavespic=s=640x120:colors=#3B82F6', $command[$filterIndex + 1]);
    }

    public function test_derivative_proxy_uses_cpu_encoder_by_default(): void
    {
        $this->stageDerivativeFixture('record-derivative', 'deriv-proxy-1', 'mp4');

        $job = new MediaJob;
        $job->id = 'job-derivative-proxy-cpu';
        $job->record_id = 'record-derivative';
        $job->operation = 'derivative';
        $job->source_path = 'archive/source.mov';
        $job->options = [
            'derivativeId' => 'deriv-proxy-1',
            'derivativeType' => 'proxy',
            'settings' => ['maxWidth' => 480],
        ];

        $artifacts = $this->processor->process($job);

        $this->assertSame('derivative_proxy', $artifacts[0]['kind']);
        $this->assertSame('libx264', $artifacts[0]['encoder']);
        $this->assertFileExists('record-derivative/derivatives/deriv-proxy-1.mp4');
        $this->assertNotContains('nvidia-smi', $this->runner->lastCommand());
    }

    /**
     * The fake runner's default nvidia-smi response reports a healthy GPU
     * (see FakeProcessRunner), so a proxy that asks for acceleration here
     * should genuinely get the GPU encoder -- confirming the "honest
     * report" half of the acceptance criterion, not just the fail-closed
     * half covered below.
     */
    public function test_derivative_proxy_uses_gpu_encoder_when_cuda_is_healthy(): void
    {
        $this->stageDerivativeFixture('record-derivative', 'deriv-proxy-gpu', 'mp4');

        $job = new MediaJob;
        $job->id = 'job-derivative-proxy-gpu';
        $job->record_id = 'record-derivative';
        $job->operation = 'derivative';
        $job->source_path = 'archive/source.mov';
        $job->options = [
            'derivativeId' => 'deriv-proxy-gpu',
            'derivativeType' => 'proxy',
            'settings' => ['accelerate' => true],
        ];

        $artifacts = $this->processor->process($job);

        $this->assertSame('h264_nvenc', $artifacts[0]['encoder']);
        $this->assertContains('h264_nvenc', $this->runner->lastCommand());
    }

    /**
     * V3-MEDIA-006 acceptance: never claim GPU acceleration unless a CUDA
     * worker is actually present and healthy. With nvidia-smi reporting
     * unhealthy, a proxy requesting acceleration must fail closed --
     * GpuUnavailableException, same as WhisperTranscriber's --device cuda
     * gate -- never a silent fallback to libx264 that would leave the
     * caller unable to tell GPU encoding didn't actually happen.
     */
    public function test_derivative_proxy_fails_closed_instead_of_silently_falling_back_when_cuda_is_unhealthy(): void
    {
        $this->runner->setResponse('cuda-capability', [
            'exitCode' => 1,
            'stdout' => '',
            'stderr' => 'NVIDIA-SMI has failed because it couldn\'t communicate with the NVIDIA driver.',
        ]);

        $job = new MediaJob;
        $job->id = 'job-derivative-proxy-no-gpu';
        $job->record_id = 'record-derivative';
        $job->operation = 'derivative';
        $job->source_path = 'archive/source.mov';
        $job->options = [
            'derivativeId' => 'deriv-proxy-no-gpu',
            'derivativeType' => 'proxy',
            'settings' => ['accelerate' => true],
        ];

        $this->expectException(GpuUnavailableException::class);
        $this->processor->process($job);

        $this->assertFileDoesNotExist('record-derivative/derivatives/deriv-proxy-no-gpu.mp4');
    }

    /**
     * A failed generation must not corrupt/leave a stray file at the final
     * derivative key -- and must never touch the source at all (ffmpeg only
     * ever reads it via -i).
     */
    public function test_derivative_failure_leaves_no_partial_output_and_never_touches_the_source(): void
    {
        $this->stageDerivativeFixture('record-derivative', 'deriv-fail-1', 'jpg');
        @mkdir('archive', 0777, true);
        file_put_contents('archive/untouched-source.mov', 'original source bytes');

        $this->runner->setResponse('default', [
            'exitCode' => 1,
            'stdout' => '',
            'stderr' => 'Error: invalid input',
        ]);

        $job = new MediaJob;
        $job->id = 'job-derivative-fail';
        $job->record_id = 'record-derivative';
        $job->operation = 'derivative';
        $job->source_path = 'archive/untouched-source.mov';
        $job->options = [
            'derivativeId' => 'deriv-fail-1',
            'derivativeType' => 'thumbnail',
            'settings' => [],
        ];

        try {
            $this->processor->process($job);
            $this->fail('Expected a RuntimeException.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('ffmpeg derivative thumbnail failed', $exception->getMessage());
        }

        $this->assertFileDoesNotExist('record-derivative/derivatives/.tmp-deriv-fail-1.jpg');
        $this->assertFileDoesNotExist('record-derivative/derivatives/deriv-fail-1.jpg');
        $this->assertSame('original source bytes', file_get_contents('archive/untouched-source.mov'));

        @unlink('archive/untouched-source.mov');
        @rmdir('archive');
    }

    public function test_derivative_of_unknown_type_throws(): void
    {
        $job = new MediaJob;
        $job->id = 'job-derivative-unknown';
        $job->record_id = 'record-derivative';
        $job->operation = 'derivative';
        $job->source_path = 'archive/source.mov';
        $job->options = ['derivativeType' => 'not-a-real-type', 'settings' => []];

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/Unknown derivative type/');
        $this->processor->process($job);
    }
}

class FfmpegProgressParserTest extends TestCase
{
    public function test_parse_returns_fraction_for_valid_time_string(): void
    {
        $output = 'frame=  100 fps=50 q=-1.0 time=00:00:05.00 bitrate=N/A';
        $progress = FfmpegProgressParser::parse($output, 10.0);

        $this->assertNotNull($progress);
        $this->assertEqualsWithDelta(0.5, $progress, 0.01);
    }

    public function test_parse_handles_different_time_formats(): void
    {
        $output = 'time=00:01:30.50';
        $progress = FfmpegProgressParser::parse($output, 120.0);

        $this->assertNotNull($progress);
        // 90.5 seconds / 120 seconds = 0.7541...
        $this->assertEqualsWithDelta(0.7541, $progress, 0.01);
    }

    public function test_parse_returns_null_for_missing_time(): void
    {
        $output = 'frame=100 fps=50 q=-1.0';
        $progress = FfmpegProgressParser::parse($output, 10.0);

        $this->assertNull($progress);
    }

    public function test_parse_returns_null_for_invalid_duration(): void
    {
        $output = 'time=00:00:05.00';
        $progress = FfmpegProgressParser::parse($output, 0.0);

        $this->assertNull($progress);
    }

    public function test_parse_clamps_to_0_1(): void
    {
        $output = 'time=00:00:15.00';
        $progress = FfmpegProgressParser::parse($output, 10.0); // Over 100%

        $this->assertNotNull($progress);
        $this->assertLessThanOrEqual(1.0, $progress);
        $this->assertGreaterThanOrEqual(0.0, $progress);
    }
}
