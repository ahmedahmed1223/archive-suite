<?php

namespace Tests\Unit;

use App\Models\MediaJob;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\WhisperTranscriber;
use PHPUnit\Framework\TestCase;

class WhisperTranscriberTest extends TestCase
{
    private FakeProcessRunner $runner;

    private WhisperTranscriber $transcriber;

    protected function setUp(): void
    {
        parent::setUp();
        $this->runner = new FakeProcessRunner();
        $this->transcriber = new WhisperTranscriber(
            $this->runner,
            'faster-whisper',
            'large-v3',
            'ar',
            'vtt'
        );
    }

    public function test_transcribe_builds_correct_command(): void
    {
        $artifact = $this->transcriber->transcribe('archive/audio.mp3', 'record-1');

        $this->assertSame('transcript', $artifact['kind']);
        $this->assertStringContainsString('record-1/transcript.vtt', $artifact['key']);
        $this->assertNull($artifact['url']);
    }

    public function test_transcribe_includes_model_parameter(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'faster-whisper',
            'base',
            'ar',
            'vtt'
        );

        $artifact = $transcriber->transcribe('archive/audio.mp3', 'record-2');

        $this->assertSame('transcript', $artifact['kind']);
    }

    public function test_transcribe_includes_language_parameter(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'faster-whisper',
            'large-v3',
            'en',
            'vtt'
        );

        $artifact = $transcriber->transcribe('archive/audio.mp3', 'record-3');

        $this->assertSame('transcript', $artifact['kind']);
    }

    public function test_transcribe_includes_output_format_parameter(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'faster-whisper',
            'large-v3',
            'ar',
            'srt'
        );

        $artifact = $transcriber->transcribe('archive/audio.mp3', 'record-4');

        $this->assertStringContainsString('record-4/transcript.srt', $artifact['key']);
    }

    public function test_real_processor_delegates_to_transcriber(): void
    {
        $job = new MediaJob();
        $job->id = 'job-whisper';
        $job->record_id = 'record-whisper';
        $job->operation = 'transcription';
        $job->source_path = 'archive/audio.mp3';
        $job->options = [];

        $processor = new RealMediaProcessor(
            $this->runner,
            $this->transcriber,
            'ffmpeg',
            'ffprobe'
        );

        $artifacts = $processor->process($job);

        $this->assertCount(1, $artifacts);
        $this->assertSame('transcript', $artifacts[0]['kind']);
        $this->assertStringContainsString('record-whisper/transcript.vtt', $artifacts[0]['key']);
    }
}
