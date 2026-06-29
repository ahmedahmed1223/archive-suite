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
    ) {}

    /**
     * Build and run a faster-whisper transcription command.
     * Returns artifact on success; throws on non-zero exit.
     *
     * @return array{kind: string, key: string, url: null}
     */
    public function transcribe(string $inputPath, string $recordId): array
    {
        // ponytail: GPU/model auto-download deferred; live whisper smoke-test deferred.
        $ext = $this->whisperOutputFormat;
        $outputKey = "{$recordId}/transcript.{$ext}";

        $command = [
            $this->whisperBinary,
            $inputPath,
            '--model', $this->whisperModel,
            '--language', $this->whisperLanguage,
            '--output_format', $ext,
            '--output_dir', $recordId,
        ];

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("Whisper transcription failed: {$result['stderr']}");
        }

        return [
            'kind' => 'transcript',
            'key' => $outputKey,
            'url' => null,
        ];
    }
}
