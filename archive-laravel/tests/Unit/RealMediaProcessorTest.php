<?php

namespace Tests\Unit;

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
        $this->runner = new FakeProcessRunner();
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
    }

    private function removeMockDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
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
        $job = new MediaJob();
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
        $job = new MediaJob();
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
        $job = new MediaJob();
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
        $this->assertContains('branding/archive-logo.png', $command);
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

        $job = new MediaJob();
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
        $job = new MediaJob();
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
        $preprocessor = new class($this->runner) extends AudioPreprocessor {
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

        $transcriber = new class($this->runner) extends WhisperTranscriber {
            public function __construct(FakeProcessRunner $runner)
            {
                parent::__construct($runner);
            }

            public function transcribe(string $inputPath, string $recordId, array $jobOptions = []): array
            {
                if (!is_dir($recordId)) {
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
        $job = new MediaJob();
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

        $job = new MediaJob();
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
        $job = new MediaJob();
        $job->id = 'job-4';
        $job->record_id = 'record-4';
        $job->operation = 'thumbnail';
        $job->source_path = 'archive/source.mov';
        $job->options = [];

        $artifacts = $this->processor->process($job);

        $this->assertNull($artifacts[0]['url']);
    }

    public function test_ignores_unknown_operation(): void
    {
        $job = new MediaJob();
        $job->id = 'job-unknown';
        $job->record_id = 'record-unknown';
        $job->operation = 'unknown_op';
        $job->options = [];

        $artifacts = $this->processor->process($job);

        $this->assertEmpty($artifacts);
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

    public function test_montage_export_concatenates_clips(): void
    {
        $job = new MediaJob();
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

    public function test_montage_export_requires_clips(): void
    {
        $job = new MediaJob();
        $job->id = 'job-montage-2';
        $job->record_id = 'record-montage-2';
        $job->operation = 'montage_export';
        $job->options = ['clips' => []];

        $this->expectException(\RuntimeException::class);
        $this->processor->process($job);
    }
}
