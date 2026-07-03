<?php

namespace App\Services\Media;

class WhisperTranscriber
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly string $whisperBinary = 'whisper-ctranslate2',
        private readonly string $whisperModel = 'large-v3',
        private readonly string $whisperLanguage = 'ar',
        private readonly string $whisperOutputFormat = 'vtt',
        private readonly string $whisperDevice = '',
        private readonly string $whisperComputeType = '',
        private readonly bool $whisperDiarize = false,
        private readonly string $hfToken = '',
    ) {}

    /**
     * Build and run a whisper-ctranslate2 transcription command.
     * Requests all output formats in one run (its --output_format flag takes a
     * single choice, not a comma list), renames the CLI's
     * {input-basename}.{ext} outputs to the canonical transcript.{ext} keys,
     * then derives a TTML sidecar from the VTT output. Throws on non-zero exit.
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
            '--output_format', 'all',
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

        if ($this->whisperDiarize && $this->hfToken !== '') {
            // whisper-ctranslate2 has no --diarize switch: passing a non-empty
            // --hf_token is what turns diarization on (needs pyannote gated
            // model access via that HuggingFace token).
            $command[] = '--hf_token';
            $command[] = $this->hfToken;
        }

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("Whisper transcription failed: {$result['stderr']}");
        }

        $this->renameCliOutput($inputPath, $recordId, 'srt', $srtKey);
        $this->renameCliOutput($inputPath, $recordId, 'vtt', $vttKey);
        $this->deriveTtml($vttKey, $ttmlKey);

        return [
            ['kind' => 'transcript_srt', 'key' => $srtKey, 'url' => null],
            ['kind' => 'transcript_vtt', 'key' => $vttKey, 'url' => null],
            ['kind' => 'transcript_ttml', 'key' => $ttmlKey, 'url' => null],
        ];
    }

    /**
     * whisper-ctranslate2 always writes {output_dir}/{input-basename}.{ext};
     * move it to the fixed transcript.{ext} key the rest of the system expects.
     * No-op if the CLI's file isn't on local disk (e.g. fake/test runs).
     */
    private function renameCliOutput(string $inputPath, string $recordId, string $extension, string $targetKey): void
    {
        $basename = pathinfo($inputPath, PATHINFO_FILENAME);
        $cliOutputPath = "{$recordId}/{$basename}.{$extension}";

        if (! is_file($cliOutputPath) || $cliOutputPath === $targetKey) {
            return;
        }

        rename($cliOutputPath, $targetKey);
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
