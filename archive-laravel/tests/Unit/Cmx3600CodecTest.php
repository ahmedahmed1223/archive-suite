<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Media\Cmx3600Codec;
use Tests\TestCase;

class Cmx3600CodecTest extends TestCase
{
    public function test_parses_straight_video_edits_and_reports_unsupported_events(): void
    {
        $report = (new Cmx3600Codec)->preview("TITLE: REEL\n001  AX       V     C        01:00:00:00 01:00:05:00 00:00:00:00 00:00:05:00\n002  AX       A     C        01:00:05:00 01:00:10:00 00:00:05:00 00:00:10:00");
        $this->assertCount(1, $report['accepted']);
        $this->assertSame('AX', $report['accepted'][0]['reel']);
        $this->assertCount(1, $report['rejected']);
        $this->assertSame('audio_track_unsupported', $report['rejected'][0]['reason']);
    }
}
