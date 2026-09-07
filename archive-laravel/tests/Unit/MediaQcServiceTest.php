<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Media\MediaPathGuard;
use App\Services\Media\MediaQcService;
use App\Services\Media\ProcessRunner;
use PHPUnit\Framework\TestCase;

class MediaQcServiceTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        parent::setUp();
        $this->root = sys_get_temp_dir().'/media-qc-'.uniqid();
        mkdir($this->root.'/ingest', 0777, true);
        file_put_contents($this->root.'/ingest/source.mov', 'fixture');
    }

    protected function tearDown(): void
    {
        @unlink($this->root.'/ingest/source.mov');
        @rmdir($this->root.'/ingest');
        @rmdir($this->root);
        parent::tearDown();
    }

    public function test_it_runs_real_qc_filters_and_retains_timed_findings(): void
    {
        $runner = new class implements ProcessRunner {
            /** @var list<array<int, string>> */
            public array $commands = [];

            public function run(array $command, ?callable $onProgress = null, ?callable $isCanceled = null): array
            {
                $this->commands[] = $command;
                if ($command[0] === 'ffprobe') {
                    return ['exitCode' => 0, 'stdout' => json_encode([
                        'format' => [],
                        'streams' => [
                            ['index' => 0, 'codec_type' => 'video', 'codec_name' => 'h264'],
                            ['index' => 1, 'codec_type' => 'audio', 'codec_name' => 'aac'],
                        ],
                    ], JSON_THROW_ON_ERROR), 'stderr' => ''];
                }
                if (in_array('-vf', $command, true)) {
                    return ['exitCode' => 0, 'stdout' => '', 'stderr' => 'black_start:2.0 black_end:4.5 black_duration:2.5 freeze_start: 8.0 freeze_end: 11.0 freeze_duration: 3.0'];
                }
                if (in_array('-af', $command, true) && str_contains((string) $command[array_search('-af', $command, true) + 1], 'silencedetect')) {
                    return ['exitCode' => 0, 'stdout' => '', 'stderr' => 'silence_start: 15.0 silence_end: 18.0 silence_duration: 3.0 max_volume: -0.2 dB'];
                }
                if (in_array('-af', $command, true)) {
                    return ['exitCode' => 0, 'stdout' => '', 'stderr' => 'I: -30.5 LUFS'];
                }
                return ['exitCode' => 0, 'stdout' => '', 'stderr' => ''];
            }
        };

        $report = (new MediaQcService($runner, new MediaPathGuard($this->root), 'ffmpeg', 'ffprobe'))->inspect('ingest/source.mov');

        $this->assertSame('failed', $report['status']);
        $this->assertSame('black_frame', $report['findings'][3]['rule']);
        $this->assertSame(2.0, $report['findings'][3]['startSeconds']);
        $this->assertSame('frozen_frame', $report['findings'][4]['rule']);
        $this->assertSame('silence', $report['findings'][5]['rule']);
        $this->assertSame('failed', $report['findings'][6]['status']);
        $this->assertSame('warning', $report['findings'][7]['status']);
        $this->assertTrue(collect($runner->commands)->contains(fn (array $command): bool => in_array('-vf', $command, true)));
    }
}
