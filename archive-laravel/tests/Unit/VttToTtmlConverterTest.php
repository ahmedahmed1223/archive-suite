<?php

namespace Tests\Unit;

use App\Services\Media\VttToTtmlConverter;
use PHPUnit\Framework\TestCase;

class VttToTtmlConverterTest extends TestCase
{
    public function test_converts_single_cue_to_ttml(): void
    {
        $vtt = <<<VTT
        WEBVTT

        00:00:01.000 --> 00:00:04.000
        Hello world
        VTT;

        $ttml = VttToTtmlConverter::convert($vtt);

        $this->assertStringContainsString('<?xml version="1.0" encoding="UTF-8"?>', $ttml);
        $this->assertStringContainsString('<tt', $ttml);
        $this->assertStringContainsString('begin="00:00:01.000"', $ttml);
        $this->assertStringContainsString('end="00:00:04.000"', $ttml);
        $this->assertStringContainsString('Hello world', $ttml);
    }

    public function test_converts_multiple_cues(): void
    {
        $vtt = <<<VTT
        WEBVTT

        00:00:01.000 --> 00:00:02.000
        First line

        00:00:02.500 --> 00:00:03.500
        Second line
        VTT;

        $ttml = VttToTtmlConverter::convert($vtt);

        $this->assertSame(2, substr_count($ttml, '<p '));
        $this->assertStringContainsString('First line', $ttml);
        $this->assertStringContainsString('Second line', $ttml);
    }

    public function test_escapes_html_special_characters(): void
    {
        $vtt = <<<VTT
        WEBVTT

        00:00:01.000 --> 00:00:02.000
        Tom & Jerry <fun>
        VTT;

        $ttml = VttToTtmlConverter::convert($vtt);

        $this->assertStringContainsString('Tom &amp; Jerry &lt;fun&gt;', $ttml);
    }

    public function test_ignores_cue_identifiers_and_empty_body(): void
    {
        $vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nOnly line";

        $ttml = VttToTtmlConverter::convert($vtt);

        $this->assertSame(1, substr_count($ttml, '<p '));
        $this->assertStringContainsString('Only line', $ttml);
    }
}
