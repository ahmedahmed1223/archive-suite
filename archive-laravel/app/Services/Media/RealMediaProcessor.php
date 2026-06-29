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

        // ponytail: basic h264/aac transcode; extend with preset/crf when needed
        $command = [
            $this->ffmpegPath,
            '-i', $sourceKey,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-c:a', 'aac',
            '-b:a', '128k',
            $outputKey,
        ];

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
        $artifact = $this->transcriber->transcribe($job->source_path, $job->record_id);

        return [$artifact];
    }
}
