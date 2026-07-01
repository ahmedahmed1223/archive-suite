<?php

namespace Tests\Unit;

use App\Models\MediaJob;
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
            'faster-whisper',
            'large-v3',
            'ar',
            'vtt'
        );
        $this->processor = new RealMediaProcessor($this->runner, $transcriber, 'ffmpeg', 'ffprobe');
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
}
