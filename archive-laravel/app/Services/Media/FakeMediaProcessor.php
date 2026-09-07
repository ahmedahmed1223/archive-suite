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
            'media_probe' => [[
                'kind' => 'media_probe_report',
                'key' => null,
                'url' => null,
                'report' => [
                    'formatNames' => ['mov', 'mp4'],
                    'formatLongName' => 'QuickTime / MOV',
                    'durationSeconds' => 62.52,
                    'startTimeSeconds' => 0.0,
                    'sizeBytes' => 1048576,
                    'bitRate' => 134174,
                    'tags' => [],
                    'streams' => [],
                ],
            ]],
            'media_qc' => [[
                'kind' => 'media_qc_report',
                'key' => null,
                'url' => null,
                'report' => [
                    'status' => 'passed',
                    'findings' => [[
                        'rule' => 'decode',
                        'startSeconds' => 0.0,
                        'endSeconds' => null,
                        'status' => 'passed',
                        'evidence' => 'Media stream decoded successfully.',
                    ]],
                    'metrics' => ['decodeExitCode' => 0],
                ],
            ]],
            'montage_export' => [
                [
                    'kind' => 'montage_mp4',
                    'key' => "{$job->record_id}/montage.mp4",
                    'url' => null,
                ],
            ],
            'derivative' => $this->fakeDerivative($job),
            default => [],
        };
    }

    /**
     * Deterministic fake artifact for the V3-MEDIA-006 derivative pipeline
     * (thumbnail/waveform/proxy). Mirrors RealMediaProcessor's
     * "{recordId}/derivatives/{derivativeId}.{ext}" key shape so tests and
     * offline mode exercise the same storage_key format the real processor
     * produces.
     *
     * @return array<int, array{kind: string, key: string, url: null}>
     */
    private function fakeDerivative(MediaJob $job): array
    {
        $type = is_string($job->options['derivativeType'] ?? null) ? $job->options['derivativeType'] : 'thumbnail';
        $derivativeId = is_string($job->options['derivativeId'] ?? null) ? $job->options['derivativeId'] : $job->id;
        $extension = match ($type) {
            'waveform' => 'png',
            'proxy' => 'mp4',
            default => 'jpg',
        };

        return [
            [
                'kind' => "derivative_{$type}",
                'key' => "{$job->record_id}/derivatives/{$derivativeId}.{$extension}",
                'url' => null,
            ],
        ];
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
