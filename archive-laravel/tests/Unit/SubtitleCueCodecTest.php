<?php

namespace Tests\Unit;

use App\Services\Media\SubtitleCueCodec;
use PHPUnit\Framework\TestCase;

class SubtitleCueCodecTest extends TestCase
{
    public function test_srt_round_trips_through_serialize_and_parse(): void
    {
        $cues = [
            ['startSeconds' => 1.5, 'endSeconds' => 3.25, 'text' => 'مرحبا بالعالم'],
            ['startSeconds' => 4.0, 'endSeconds' => 5.75, 'text' => 'Second line'],
        ];

        $srt = SubtitleCueCodec::toSrt($cues);
        $parsed = SubtitleCueCodec::parse($srt);

        $this->assertSame($cues, $parsed);
    }

    public function test_vtt_round_trips_through_serialize_and_parse(): void
    {
        $cues = [
            ['startSeconds' => 0.0, 'endSeconds' => 2.0, 'text' => 'أهلاً وسهلاً'],
            ['startSeconds' => 2.5, 'endSeconds' => 6.125, 'text' => 'Second cue in English'],
        ];

        $vtt = SubtitleCueCodec::toVtt($cues);
        $this->assertStringStartsWith('WEBVTT', $vtt);

        $parsed = SubtitleCueCodec::parse($vtt);
        $this->assertSame($cues, $parsed);
    }

    public function test_srt_uses_comma_millisecond_separator_and_vtt_uses_dot(): void
    {
        $cues = [['startSeconds' => 61.25, 'endSeconds' => 65.0, 'text' => 'x']];

        $this->assertStringContainsString('00:01:01,250 --> 00:01:05,000', SubtitleCueCodec::toSrt($cues));
        $this->assertStringContainsString('00:01:01.250 --> 00:01:05.000', SubtitleCueCodec::toVtt($cues));
    }

    public function test_serialize_dispatches_on_format(): void
    {
        $cues = [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'x']];

        $this->assertStringStartsWith('WEBVTT', SubtitleCueCodec::serialize($cues, 'vtt'));
        $this->assertStringStartsWith('1', SubtitleCueCodec::serialize($cues, 'srt'));
    }

    public function test_parse_ignores_blocks_without_a_timing_line(): void
    {
        $content = "NOTE this is a comment\n\n1\n00:00:01,000 --> 00:00:02,000\nOnly real cue";
        $parsed = SubtitleCueCodec::parse($content);

        $this->assertCount(1, $parsed);
        $this->assertSame('Only real cue', $parsed[0]['text']);
    }
}
