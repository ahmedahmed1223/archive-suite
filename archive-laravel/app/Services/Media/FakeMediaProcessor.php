<?php

namespace App\Services\Media;

use App\Models\MediaJob;

class FakeMediaProcessor implements MediaProcessor
{
    /**
     * Deterministically generate artifacts based on operation type.
     *
     * @return array<int, array<string, mixed>>
     */
    public function process(MediaJob $job): array
    {
        return match ($job->operation) {
            'thumbnail' => [
                [
                    'kind' => 'thumbnail',
                    'key' => "{$job->record_id}/thumb.jpg",
                    'url' => null,
                ],
            ],
            'transcode' => [
                [
                    'kind' => 'video',
                    'key' => "{$job->record_id}/transcoded.mp4",
                    'url' => null,
                ],
            ],
            'transcription' => $this->fakeTranscription($job),
            'ocr' => [
                [
                    'kind' => 'ocr_text',
                    'key' => "{$job->record_id}/ocr.txt",
                    'url' => null,
                ],
            ],
            'montage_export' => [
                [
                    'kind' => 'montage_mp4',
                    'key' => "{$job->record_id}/montage.mp4",
                    'url' => null,
                ],
            ],
            default => [],
        };
    }

    /**
     * Return fake transcription artifacts for all requested formats.
     *
     * @return array<int, array{kind: string, key: string, url: null}>
     */
    private function fakeTranscription(MediaJob $job): array
    {
        $outputFormats = $job->options['outputFormats'] ?? ['srt', 'vtt', 'ttml'];
        $artifacts = [];

        foreach ($outputFormats as $format) {
            $artifacts[] = [
                'kind' => "transcript_{$format}",
                'key' => "{$job->record_id}/transcript.{$format}",
                'url' => null,
            ];
        }

        return $artifacts;
    }
}
