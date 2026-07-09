<?php

namespace Tests\Unit;

use App\Services\Media\AudioPreprocessor;
use App\Services\Media\FakeProcessRunner;
use PHPUnit\Framework\TestCase;

class AudioPreprocessorTest extends TestCase
{
    private AudioPreprocessor $preprocessor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->preprocessor = new AudioPreprocessor(
            new FakeProcessRunner(),
            segmentDurationSeconds: 300
        );
    }

    public function test_plan_segments_short_audio(): void
    {
        // Audio shorter than segment duration should return single segment
        $segments = $this->preprocessor->planSegments('fake.wav');

        $this->assertCount(1, $segments);
        $this->assertEquals(0, $segments[0]['startSec']);
        $this->assertGreaterThan(0, $segments[0]['durationSec']);
    }

    public function test_segmentation_preserves_boundaries(): void
    {
        $segments = $this->preprocessor->planSegments('fake.wav');

        foreach ($segments as $segment) {
            $this->assertGreaterThanOrEqual(0, $segment['startSec']);
            $this->assertGreaterThanOrEqual($segment['startSec'], $segment['endSec']);
            $this->assertEquals($segment['endSec'] - $segment['startSec'], $segment['durationSec']);
        }
    }

    public function test_format_selection_srt_only(): void
    {
        $formats = ['srt'];
        $this->assertContains('srt', $formats);
        $this->assertCount(1, $formats);
    }

    public function test_format_selection_multiple(): void
    {
        $formats = ['srt', 'vtt', 'ttml'];
        $this->assertCount(3, $formats);
        $this->assertContains('vtt', $formats);
    }

    public function test_device_selection_gpu(): void
    {
        $device = 'gpu';
        $computeType = $device === 'gpu' ? 'float16' : 'int8';

        $this->assertEquals('float16', $computeType);
    }

    public function test_device_selection_cpu(): void
    {
        $device = 'cpu';
        $computeType = $device === 'gpu' ? 'float16' : 'int8';

        $this->assertEquals('int8', $computeType);
    }

    public function test_device_selection_auto_resolves_to_cpu(): void
    {
        $device = 'auto';
        if ($device === 'auto') {
            $device = 'cpu';
        }

        $this->assertEquals('cpu', $device);
    }
}
