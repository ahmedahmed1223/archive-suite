<?php

namespace App\Domain\Montage;

/**
 * Builds a validated render manifest from an allowlisted preset and a
 * revision's clips. Source media is resolved from record ids + pinned version
 * tokens — a client-supplied path or codec is rejected, never executed.
 */
class MontageRenderManifestBuilder
{
    /** The only presets a client may name. Everything else is 422. */
    private const PRESETS = [
        'web-1080p' => ['width' => 1920, 'height' => 1080, 'v' => 'h264', 'a' => 'aac', 'kbps' => 8000],
        'web-4k' => ['width' => 3840, 'height' => 2160, 'v' => 'h264', 'a' => 'aac', 'kbps' => 35000],
        'archive-master' => ['width' => null, 'height' => null, 'v' => 'ffv1', 'a' => 'pcm_s16le', 'kbps' => null],
    ];

    public function build(string $preset, string $revisionId, array $clips): MontageRenderManifest
    {
        $spec = self::PRESETS[$preset] ?? throw new MontageValidationException([
            'preset' => "Unknown export preset '$preset'.",
        ]);

        $sources = [];
        $manifestClips = [];

        foreach ($clips as $i => $clip) {
            $recordId = $clip['source']['recordId'] ?? null;
            if (! is_string($recordId) || $recordId === ''
                || str_contains($recordId, '/') || str_contains($recordId, '\\')
                || str_contains($recordId, '..')) {
                throw new MontageValidationException([
                    "clips.$i.source.recordId" => 'Source must be a record id; local paths are not accepted.',
                ]);
            }

            $token = $clip['source']['sourceVersionToken'] ?? null;
            if (! is_string($token) || $token === '') {
                throw new MontageValidationException([
                    "clips.$i.source.sourceVersionToken" => 'Missing source version token.',
                ]);
            }

            $sourceIn = (float) ($clip['sourceIn'] ?? 0);
            $sourceOut = (float) ($clip['sourceOut'] ?? 0);
            if ($sourceOut <= $sourceIn) {
                throw new MontageValidationException([
                    "clips.$i.sourceOut" => 'sourceOut must be greater than sourceIn.',
                ]);
            }

            $sources[$recordId] ??= [
                'recordId' => $recordId,
                'sourceVersionToken' => $token,
                // Resolved server-side at render time from the record id.
                'remotePath' => "records/$recordId/master",
            ];

            $manifestClips[] = [
                'id' => $clip['id'],
                'remotePath' => "records/$recordId/master",
                'sourceIn' => $sourceIn,
                'durationSeconds' => round($sourceOut - $sourceIn, 3),
                'timelineStart' => (float) ($clip['timelineStart'] ?? 0),
            ];
        }

        return new MontageRenderManifest(
            revisionId: $revisionId,
            preset: $preset,
            width: $spec['width'],
            height: $spec['height'],
            videoCodec: $spec['v'],
            audioCodec: $spec['a'],
            videoBitrateKbps: $spec['kbps'],
            clips: $manifestClips,
            sources: array_values($sources),
        );
    }
}
