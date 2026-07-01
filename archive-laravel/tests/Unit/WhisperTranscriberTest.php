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
        $artifacts = $this->transcriber->transcribe('archive/audio.mp3', 'record-1');

        $kinds = array_column($artifacts, 'kind');
        $this->assertContains('transcript_srt', $kinds);
        $this->assertContains('transcript_vtt', $kinds);
        $this->assertContains('transcript_ttml', $kinds);
        foreach ($artifacts as $artifact) {
            $this->assertNull($artifact['url']);
        }
    }

    public function test_transcribe_requests_srt_and_vtt_output_formats(): void
    {
        $this->transcriber->transcribe('archive/audio.mp3', 'record-1');

        $command = $this->runner->lastCommand();
        $formatIndex = array_search('--output_format', $command, true);

        $this->assertNotFalse($formatIndex);
        $this->assertSame('srt,vtt', $command[$formatIndex + 1]);
    }

    public function test_transcribe_returns_srt_and_vtt_keys_and_derives_ttml(): void
    {
        $artifacts = $this->transcriber->transcribe('archive/audio.mp3', 'record-1');
        $byKind = [];
        foreach ($artifacts as $artifact) {
            $byKind[$artifact['kind']] = $artifact;
        }

        $this->assertStringContainsString('record-1/transcript.srt', $byKind['transcript_srt']['key']);
        $this->assertStringContainsString('record-1/transcript.vtt', $byKind['transcript_vtt']['key']);
        $this->assertStringContainsString('record-1/transcript.ttml', $byKind['transcript_ttml']['key']);
    }

    public function test_transcribe_does_not_pass_diarize_flag_by_default(): void
    {
        $this->transcriber->transcribe('archive/audio.mp3', 'record-1');

        $command = $this->runner->lastCommand();
        $this->assertNotContains('--diarize', $command);
    }

    public function test_transcribe_passes_diarize_flag_when_enabled(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'faster-whisper',
            'large-v3',
            'ar',
            'vtt',
            '',
            '',
            true
        );

        $transcriber->transcribe('archive/audio.mp3', 'record-diarize');

        $command = $this->runner->lastCommand();
        $this->assertContains('--diarize', $command);
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

        $artifacts = $transcriber->transcribe('archive/audio.mp3', 'record-2');

        $this->assertContains('transcript_vtt', array_column($artifacts, 'kind'));
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

        $artifacts = $transcriber->transcribe('archive/audio.mp3', 'record-3');

        $this->assertContains('transcript_vtt', array_column($artifacts, 'kind'));
    }

    public function test_transcribe_always_produces_srt_vtt_and_ttml_regardless_of_configured_format(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'faster-whisper',
            'large-v3',
            'ar',
            'srt'
        );

        $artifacts = $transcriber->transcribe('archive/audio.mp3', 'record-4');
        $kinds = array_column($artifacts, 'kind');

        $this->assertContains('transcript_srt', $kinds);
        $this->assertContains('transcript_vtt', $kinds);
        $this->assertContains('transcript_ttml', $kinds);
    }

    public function test_transcribe_includes_gpu_device_and_compute_type(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'faster-whisper',
            'large-v3',
            'ar',
            'vtt',
            'cuda',
            'float16'
        );

        $transcriber->transcribe('archive/audio.mp3', 'record-gpu');

        $command = $this->runner->lastCommand();
        $this->assertContains('--device', $command);
        $this->assertContains('cuda', $command);
        $this->assertContains('--compute_type', $command);
        $this->assertContains('float16', $command);
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

        $this->assertCount(3, $artifacts);
        $kinds = array_column($artifacts, 'kind');
        $this->assertContains('transcript_srt', $kinds);
        $this->assertContains('transcript_vtt', $kinds);
        $this->assertContains('transcript_ttml', $kinds);
    }
}
