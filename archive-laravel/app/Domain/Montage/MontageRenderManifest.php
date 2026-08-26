<?php

namespace App\Domain\Montage;

/**
 * Server-side render manifest. Every FFmpeg argument originates from these
 * allowlists; the client names only a preset — never a codec, filter graph,
 * path, or shell fragment.
 */
class MontageRenderManifest
{
    /**
     * @param array<int, array<string, mixed>> $clips
     * @param array<int, array<string, mixed>> $sources
     */
    public function __construct(
        public readonly string $revisionId,
        public readonly string $preset,
        public readonly int $width,
        public readonly int $height,
        public readonly string $videoCodec,
        public readonly string $audioCodec,
        public readonly ?int $videoBitrateKbps,
        public readonly array $clips,
        public readonly array $sources,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'revisionId' => $this->revisionId,
            'preset' => $this->preset,
            'width' => $this->width,
            'height' => $this->height,
            'videoCodec' => $this->videoCodec,
            'audioCodec' => $this->audioCodec,
            'videoBitrateKbps' => $this->videoBitrateKbps,
            'clips' => $this->clips,
            'sources' => $this->sources,
        ];
    }
}
