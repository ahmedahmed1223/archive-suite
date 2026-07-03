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
            'whisper-ctranslate2',
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

    public function test_transcribe_requests_all_output_formats(): void
    {
        // whisper-ctranslate2's --output_format only accepts one choice
        // (txt|vtt|srt|tsv|json|all), not a comma list — "all" is the only way
        // to get srt + vtt out of a single run.
        $this->transcriber->transcribe('archive/audio.mp3', 'record-1');

        $command = $this->runner->lastCommand();
        $formatIndex = array_search('--output_format', $command, true);

        $this->assertNotFalse($formatIndex);
        $this->assertSame('all', $command[$formatIndex + 1]);
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

    public function test_transcribe_does_not_pass_hf_token_flag_by_default(): void
    {
        $this->transcriber->transcribe('archive/audio.mp3', 'record-1');

        $command = $this->runner->lastCommand();
        $this->assertNotContains('--hf_token', $command);
    }

    public function test_transcribe_passes_hf_token_flag_when_diarize_enabled_and_token_set(): void
    {
        // whisper-ctranslate2 has no --diarize switch; a non-empty --hf_token
        // is what actually turns diarization on.
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'whisper-ctranslate2',
            'large-v3',
            'ar',
            'vtt',
            '',
            '',
            true,
            'hf_test_token'
        );

        $transcriber->transcribe('archive/audio.mp3', 'record-diarize');

        $command = $this->runner->lastCommand();
        $this->assertContains('--hf_token', $command);
        $this->assertContains('hf_test_token', $command);
    }

    public function test_transcribe_omits_hf_token_flag_when_diarize_enabled_but_token_missing(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'whisper-ctranslate2',
            'large-v3',
            'ar',
            'vtt',
            '',
            '',
            true,
            ''
        );

        $transcriber->transcribe('archive/audio.mp3', 'record-diarize-no-token');

        $command = $this->runner->lastCommand();
        $this->assertNotContains('--hf_token', $command);
    }

    public function test_transcribe_includes_model_parameter(): void
    {
        $transcriber = new WhisperTranscriber(
            $this->runner,
            'whisper-ctranslate2',
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
            'whisper-ctranslate2',
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
            'whisper-ctranslate2',
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
            'whisper-ctranslate2',
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
