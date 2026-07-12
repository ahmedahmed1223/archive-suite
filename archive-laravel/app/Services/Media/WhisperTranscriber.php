<?php

namespace App\Services\Media;

class WhisperTranscriber
{
    private readonly MediaPathGuard $pathGuard;

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
        ?MediaPathGuard $pathGuard = null,
    ) {
        $this->pathGuard = $pathGuard ?? new MediaPathGuard();
    }

    /**
     * Build and run a whisper-ctranslate2 transcription command.
     * Per-job device and output format selection override global config.
     * Throws on non-zero exit.
     *
     * @param  array{device?: string, computeType?: string, outputFormats?: string[]}  $jobOptions
     * @return array<int, array{kind: string, key: string, url: null}>
     */
    public function transcribe(string $inputPath, string $recordId, array $jobOptions = []): array
    {
        // ponytail: live whisper smoke-test deferred.
        $device = $jobOptions['device'] ?? $this->whisperDevice;
        $computeType = $jobOptions['computeType'] ?? $this->whisperComputeType;
        $outputFormats = $jobOptions['outputFormats'] ?? ['srt', 'vtt', 'ttml'];

        // Normalize formats: always include 'vtt' for TTML derivation
        if (!in_array('vtt', $outputFormats, true)) {
            $outputFormats[] = 'vtt';
        }

        // recordId is client input; resolveOutputDir contains it under the
        // storage root and creates it. Artifact keys stay relative to recordId
        // (unchanged API contract) — only the on-disk path is absolute.
        $outputDir = $this->pathGuard->resolveOutputDir($recordId, 'transcription output');

        $command = [
            $this->whisperBinary,
            $inputPath,
            '--model', $this->whisperModel,
            '--language', $this->whisperLanguage,
            '--output_format', 'all',
            '--output_dir', $outputDir,
        ];

        if ($device !== '') {
            $command[] = '--device';
            $command[] = $device;
        }

        if ($computeType !== '') {
            $command[] = '--compute_type';
            $command[] = $computeType;
        }

        if ($this->whisperDiarize && $this->hfToken !== '') {
            $command[] = '--hf_token';
            $command[] = $this->hfToken;
        }

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("Whisper transcription failed: {$result['stderr']}");
        }

        $artifacts = [];
        foreach ($outputFormats as $format) {
            $key = "{$recordId}/transcript.{$format}";
            $targetPath = $outputDir.DIRECTORY_SEPARATOR."transcript.{$format}";
            $this->renameCliOutput($inputPath, $outputDir, $format, $targetPath);
            if (is_file($targetPath)) {
                $artifacts[] = [
                    'kind' => "transcript_{$format}",
                    'key' => $key,
                    'url' => null,
                ];
            }
        }

        // Derive TTML from VTT if both are requested
        if (in_array('ttml', $outputFormats, true) && in_array('vtt', $outputFormats, true)) {
            $vttPath = $outputDir.DIRECTORY_SEPARATOR.'transcript.vtt';
            $ttmlPath = $outputDir.DIRECTORY_SEPARATOR.'transcript.ttml';
            $this->deriveTtml($vttPath, $ttmlPath);
            if (is_file($ttmlPath) && !$this->hasArtifact($artifacts, 'transcript_ttml')) {
                $artifacts[] = [
                    'kind' => 'transcript_ttml',
                    'key' => "{$recordId}/transcript.ttml",
                    'url' => null,
                ];
            }
        }

        return $artifacts;
    }

    /**
     * Check if an artifact with the given kind already exists in the list.
     */
    private function hasArtifact(array $artifacts, string $kind): bool
    {
        foreach ($artifacts as $artifact) {
            if ($artifact['kind'] === $kind) {
                return true;
            }
        }
        return false;
    }

    /**
     * whisper-ctranslate2 always writes {output_dir}/{input-basename}.{ext};
     * move it to the fixed transcript.{ext} key the rest of the system expects.
     * No-op if the CLI's file isn't on local disk (e.g. fake/test runs).
     */
    private function renameCliOutput(string $inputPath, string $outputDir, string $extension, string $targetPath): void
    {
        $basename = pathinfo($inputPath, PATHINFO_FILENAME);
        $cliOutputPath = $outputDir.DIRECTORY_SEPARATOR."{$basename}.{$extension}";

        if (! is_file($cliOutputPath) || $cliOutputPath === $targetPath) {
            return;
        }

        rename($cliOutputPath, $targetPath);
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
