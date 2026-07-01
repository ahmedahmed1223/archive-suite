<?php

namespace App\Services\Media;

class WhisperTranscriber
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly string $whisperBinary = 'faster-whisper',
        private readonly string $whisperModel = 'large-v3',
        private readonly string $whisperLanguage = 'ar',
        private readonly string $whisperOutputFormat = 'vtt',
        private readonly string $whisperDevice = '',
        private readonly string $whisperComputeType = '',
        private readonly bool $whisperDiarize = false,
    ) {}

    /**
     * Build and run a faster-whisper transcription command.
     * Requests SRT + VTT from whisper-ctranslate2 in one run, then derives a
     * TTML sidecar from the VTT output. Returns one artifact per format;
     * throws on non-zero exit.
     *
     * @return array<int, array{kind: string, key: string, url: null}>
     */
    public function transcribe(string $inputPath, string $recordId): array
    {
        // ponytail: GPU/model auto-download deferred; live whisper smoke-test deferred.
        $srtKey = "{$recordId}/transcript.srt";
        $vttKey = "{$recordId}/transcript.vtt";
        $ttmlKey = "{$recordId}/transcript.ttml";

        $command = [
            $this->whisperBinary,
            $inputPath,
            '--model', $this->whisperModel,
            '--language', $this->whisperLanguage,
            '--output_format', 'srt,vtt',
            '--output_dir', $recordId,
        ];

        if ($this->whisperDevice !== '') {
            $command[] = '--device';
            $command[] = $this->whisperDevice;
        }

        if ($this->whisperComputeType !== '') {
            $command[] = '--compute_type';
            $command[] = $this->whisperComputeType;
        }

        if ($this->whisperDiarize) {
            // Requires a HuggingFace auth token for pyannote gated models;
            // set HF_TOKEN in the environment where whisper-ctranslate2 runs.
            $command[] = '--diarize';
        }

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("Whisper transcription failed: {$result['stderr']}");
        }

        $this->deriveTtml($vttKey, $ttmlKey);

        return [
            ['kind' => 'transcript_srt', 'key' => $srtKey, 'url' => null],
            ['kind' => 'transcript_vtt', 'key' => $vttKey, 'url' => null],
            ['kind' => 'transcript_ttml', 'key' => $ttmlKey, 'url' => null],
        ];
    }

    /**
     * Best-effort: convert the VTT whisper wrote into a TTML sidecar.
     * No-op if the VTT file isn't on local disk (e.g. fake/test runs).
     */
    private function deriveTtml(string $vttKey, string $ttmlKey): void
    {
        if (! is_file($vttKey)) {
            return;
        }

        $vttContent = file_get_contents($vttKey);
        if ($vttContent === false) {
            return;
        }

        file_put_contents($ttmlKey, VttToTtmlConverter::convert($vttContent));
    }
}
