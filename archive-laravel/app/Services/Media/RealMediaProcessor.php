<?php

namespace App\Services\Media;

use App\Models\MediaJob;

class RealMediaProcessor implements MediaProcessor
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly WhisperTranscriber $transcriber,
        private readonly string $ffmpegPath = 'ffmpeg',
        private readonly string $ffprobePath = 'ffprobe',
        private readonly array $watermark = [],
        private readonly ?OcrClient $ocrClient = null,
    ) {}

    /**
     * Process a media job using ffmpeg command-line tools.
     *
     * @return array<int, array<string, mixed>>
     */
    public function process(MediaJob $job): array
    {
        return match ($job->operation) {
            'thumbnail' => $this->processThumbnail($job),
            'transcode' => $this->processTranscode($job),
            'transcription' => $this->processTranscription($job),
            'ocr' => $this->processOcr($job),
            default => [],
        };
    }

    private function processThumbnail(MediaJob $job): array
    {
        $sourceKey = $job->source_path;
        $atSec = $job->options['atSec'] ?? 0;
        $outputKey = "{$job->record_id}/thumb.jpg";

        $command = [
            $this->ffmpegPath,
            '-i', $sourceKey,
            '-ss', (string) $atSec,
            '-vframes', '1',
            '-q:v', '2',
            $outputKey,
        ];

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("ffmpeg thumbnail failed: {$result['stderr']}");
        }

        return [
            [
                'kind' => 'thumbnail',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    private function processTranscode(MediaJob $job): array
    {
        $sourceKey = $job->source_path;
        $outputKey = "{$job->record_id}/transcoded.mp4";
        $watermark = $this->watermarkOptions($job);

        $command = [
            $this->ffmpegPath,
            '-i', $sourceKey,
        ];

        if ($watermark !== null) {
            $command[] = '-i';
            $command[] = $watermark['path'];
            $command[] = '-filter_complex';
            $command[] = $this->buildWatermarkFilter($watermark);
            $command[] = '-map';
            $command[] = '[v]';
            $command[] = '-map';
            $command[] = '0:a?';
        }

        array_push(
            $command,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-c:a', 'aac',
            '-b:a', '128k',
            $outputKey,
        );

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("ffmpeg transcode failed: {$result['stderr']}");
        }

        return [
            [
                'kind' => 'video',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    private function processTranscription(MediaJob $job): array
    {
        return $this->transcriber->transcribe($job->source_path, $job->record_id);
    }

    private function processOcr(MediaJob $job): array
    {
        $client = $this->ocrClient ?? new OcrClient();
        $text = $client->extractText($job->source_path);

        $outputKey = "{$job->record_id}/ocr.txt";
        file_put_contents($outputKey, $text);

        return [
            [
                'kind' => 'ocr_text',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    /**
     * @return array{path: string, position: string, opacity: float, margin: int}|null
     */
    private function watermarkOptions(MediaJob $job): ?array
    {
        $jobWatermark = $job->options['watermark'] ?? null;

        if (is_array($jobWatermark) && array_key_exists('enabled', $jobWatermark) && ! $this->truthy($jobWatermark['enabled'])) {
            return null;
        }

        $candidate = is_array($jobWatermark)
            ? array_merge($this->watermark, $jobWatermark)
            : $this->watermark;

        if (! is_array($candidate) || (! $this->truthy($candidate['enabled'] ?? false) && ! is_array($jobWatermark))) {
            return null;
        }

        $path = $candidate['path'] ?? null;
        if (! is_string($path) || trim($path) === '') {
            return null;
        }

        return [
            'path' => trim($path),
            'position' => $this->normalizeWatermarkPosition($candidate['position'] ?? 'bottom-right'),
            'opacity' => $this->clampFloat($candidate['opacity'] ?? 0.85, 0.0, 1.0),
            'margin' => max(0, min((int) ($candidate['margin'] ?? 24), 512)),
        ];
    }

    /**
     * @param  array{path: string, position: string, opacity: float, margin: int}  $watermark
     */
    private function buildWatermarkFilter(array $watermark): string
    {
        [$x, $y] = match ($watermark['position']) {
            'top-left' => [(string) $watermark['margin'], (string) $watermark['margin']],
            'top-right' => ["W-w-{$watermark['margin']}", (string) $watermark['margin']],
            'bottom-left' => [(string) $watermark['margin'], "H-h-{$watermark['margin']}"],
            'center' => ['(W-w)/2', '(H-h)/2'],
            default => ["W-w-{$watermark['margin']}", "H-h-{$watermark['margin']}"],
        };

        $opacity = rtrim(rtrim(sprintf('%.3F', $watermark['opacity']), '0'), '.');

        return "[1:v]format=rgba,colorchannelmixer=aa={$opacity}[wm];[0:v][wm]overlay=x={$x}:y={$y}[v]";
    }

    private function normalizeWatermarkPosition(mixed $position): string
    {
        if (! is_string($position)) {
            return 'bottom-right';
        }

        return match ($position) {
            'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center' => $position,
            default => 'bottom-right',
        };
    }

    private function clampFloat(mixed $value, float $min, float $max): float
    {
        return max($min, min((float) $value, $max));
    }

    private function truthy(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
        }

        return (bool) $value;
    }
}
