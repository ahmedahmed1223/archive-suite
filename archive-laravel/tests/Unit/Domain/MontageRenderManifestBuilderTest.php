<?php

namespace Tests\Unit\Domain;

use App\Domain\Montage\MontageRenderManifestBuilder;
use App\Domain\Montage\MontageValidationException;
use PHPUnit\Framework\TestCase;

class MontageRenderManifestBuilderTest extends TestCase
{
    private MontageRenderManifestBuilder $builder;

    protected function setUp(): void
    {
        $this->builder = new MontageRenderManifestBuilder();
    }

    public function test_builds_a_manifest_from_an_allowlisted_preset(): void
    {
        $manifest = $this->builder->build(
            preset: 'web-1080p',
            revisionId: 'rev-1',
            clips: [[
                'id' => 'c1',
                'source' => ['recordId' => 'r1', 'sourceVersionToken' => 'sha256:a'],
                'timelineStart' => 0,
                'sourceIn' => 2,
                'sourceOut' => 10,
            ]],
        );

        $this->assertSame('rev-1', $manifest->revisionId);
        $this->assertSame(1920, $manifest->width);
        $this->assertSame(1080, $manifest->height);
        $this->assertSame('h264', $manifest->videoCodec);
        // The client never dictates the path: it is derived server-side from
        // the record id inside the records/ namespace.
        $this->assertSame('records/r1/master', $manifest->sources[0]['remotePath']);
        $this->assertSame('sha256:a', $manifest->sources[0]['sourceVersionToken']);
        $this->assertSame(8.0, $manifest->clips[0]['durationSeconds']);
    }

    public function test_rejects_unknown_preset_and_client_codec_paths(): void
    {
        $this->expectException(MontageValidationException::class);
        $this->builder->build(
            preset: 'custom-4k-ffmpeg-graph',
            revisionId: 'rev-1',
            clips: [],
        );
    }

    public function test_rejects_clips_referencing_local_paths(): void
    {
        $this->expectException(MontageValidationException::class);
        $this->builder->build(
            preset: 'web-1080p',
            revisionId: 'rev-1',
            clips: [[
                'id' => 'evil',
                'source' => ['recordId' => '../../../etc/passwd', 'sourceVersionToken' => 'x'],
                'timelineStart' => 0,
                'sourceIn' => 0,
                'sourceOut' => 5,
            ]],
        );
    }
}
