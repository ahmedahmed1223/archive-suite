<?php

namespace Tests\Unit;

use App\Services\Media\FakeProcessRunner;
use App\Services\Media\MediaPathGuard;
use App\Services\Media\MediaProbeService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class MediaProbeServiceTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        parent::setUp();
        $this->root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'archive-probe-'.bin2hex(random_bytes(4));
        mkdir($this->root, 0777, true);
        file_put_contents($this->root.DIRECTORY_SEPARATOR.'news.mov', 'media');
    }

    protected function tearDown(): void
    {
        @unlink($this->root.DIRECTORY_SEPARATOR.'news.mov');
        @rmdir($this->root);
        parent::tearDown();
    }

    public function test_it_normalizes_ffprobe_output_without_leaking_the_absolute_source_path(): void
    {
        $runner = new FakeProcessRunner;
        $runner->setResponse('default', [
            'exitCode' => 0,
            'stdout' => json_encode([
                'format' => [
                    'filename' => $this->root.DIRECTORY_SEPARATOR.'news.mov',
                    'format_name' => 'mov,mp4,m4a,3gp,3g2,mj2',
                    'format_long_name' => 'QuickTime / MOV',
                    'duration' => '62.520000',
                    'start_time' => '0.000000',
                    'size' => '1048576',
                    'bit_rate' => '134174',
                    'tags' => ['encoder' => 'Media Encoder', 'ignored' => ['nested']],
                ],
                'streams' => [[
                    'index' => 0,
                    'codec_type' => 'video',
                    'codec_name' => 'h264',
                    'codec_long_name' => 'H.264 / AVC',
                    'width' => 1920,
                    'height' => 1080,
                    'avg_frame_rate' => '30000/1001',
                    'sample_aspect_ratio' => '1:1',
                    'duration' => '62.520000',
                    'bit_rate' => '128000',
                    'tags' => ['language' => 'ara'],
                    'disposition' => ['default' => 1, 'forced' => 0],
                ]],
            ], JSON_THROW_ON_ERROR),
            'stderr' => '',
        ]);

        $report = (new MediaProbeService($runner, new MediaPathGuard($this->root), 'ffprobe'))->inspect('news.mov');

        $this->assertSame(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '--', realpath($this->root.DIRECTORY_SEPARATOR.'news.mov')], $runner->lastCommand());
        $this->assertSame(['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2'], $report['formatNames']);
        $this->assertSame(62.52, $report['durationSeconds']);
        $this->assertSame(1048576, $report['sizeBytes']);
        $this->assertSame(['encoder' => 'Media Encoder'], $report['tags']);
        $this->assertSame(['numerator' => 30000, 'denominator' => 1001], $report['streams'][0]['frameRate']);
        $this->assertSame('ara', $report['streams'][0]['language']);
        $this->assertStringNotContainsString($this->root, json_encode($report, JSON_THROW_ON_ERROR));
    }

    public function test_it_rejects_invalid_ffprobe_json(): void
    {
        $runner = new FakeProcessRunner;
        $runner->setResponse('default', ['exitCode' => 0, 'stdout' => 'not-json', 'stderr' => '']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('invalid JSON');

        (new MediaProbeService($runner, new MediaPathGuard($this->root), 'ffprobe'))->inspect('news.mov');
    }
}
