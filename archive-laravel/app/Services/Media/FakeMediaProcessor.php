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
            'transcription' => [
                [
                    'kind' => 'transcript',
                    'key' => "{$job->record_id}/transcript.vtt",
                    'url' => null,
                ],
            ],
            default => [],
        };
    }
}
