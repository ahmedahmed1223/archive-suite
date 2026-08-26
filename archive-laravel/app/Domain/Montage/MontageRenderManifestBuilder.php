<?php

namespace App\Domain\Montage;

use App\Models\User;

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

    public function __construct(private readonly MontageSourceResolver $sources) {}

    public function build(string $preset, string $revisionId, array $clips, User $actor): MontageRenderManifest
    {
        $spec = self::PRESETS[$preset] ?? throw new MontageValidationException([
            'preset' => "Unknown export preset '$preset'.",
        ]);

        $sources = [];
        $manifestClips = [];

        foreach ($clips as $i => $clip) {
            if (! is_array($clip) || ! is_array($clip['source'] ?? null)) {
                throw new MontageValidationException([
                    "clips.$i.source" => 'Every clip must reference a source record.',
                ]);
            }

            $source = $this->sources->resolve($clip['source'], $actor, $i);

            foreach (['sourceIn', 'sourceOut', 'timelineStart'] as $rangeField) {
                if (! array_key_exists($rangeField, $clip) || ! is_int($clip[$rangeField]) && ! is_float($clip[$rangeField])) {
                    throw new MontageValidationException([
                        "clips.$i.$rangeField" => "$rangeField must be a finite number.",
                    ]);
                }
                if (! is_finite((float) $clip[$rangeField])) {
                    throw new MontageValidationException([
                        "clips.$i.$rangeField" => "$rangeField must be a finite number.",
                    ]);
                }
            }

            $sourceIn = (float) ($clip['sourceIn'] ?? 0);
            $sourceOut = (float) ($clip['sourceOut'] ?? 0);
            if ($sourceOut <= $sourceIn) {
                throw new MontageValidationException([
                    "clips.$i.sourceOut" => 'sourceOut must be greater than sourceIn.',
                ]);
            }

            $sourceKey = implode('|', [
                $source['recordId'],
                $source['attachmentId'] ?? '',
                $source['sourceVersionToken'],
            ]);
            $sources[$sourceKey] ??= $source;

            $manifestClips[] = [
                'id' => $clip['id'],
                'path' => $source['path'],
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
