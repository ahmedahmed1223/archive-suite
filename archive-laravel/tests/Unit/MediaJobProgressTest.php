<?php

namespace Tests\Unit;

use App\Models\MediaJob;
use Illuminate\Support\Str;
use PHPUnit\Framework\TestCase;

class MediaJobProgressTest extends TestCase
{
    public function test_media_job_progress_tracking(): void
    {
        $job = new MediaJob([
            'id' => (string) Str::uuid(),
            'record_id' => 'test-record',
            'operation' => 'transcription',
            'status' => 'processing',
            'progress_stage' => 'preprocessing',
            'progress_percent' => 10,
        ]);

        $this->assertEquals('preprocessing', $job->progress_stage);
        $this->assertEquals(10, $job->progress_percent);
    }

    public function test_media_job_progress_stage_transitions(): void
    {
        $stages = [
            'preprocessing' => 5,
            'preprocessing_complete' => 10,
            'transcribing_segment_0_3' => 15,
            'transcribing_segment_1_3' => 40,
            'transcribing_segment_2_3' => 65,
            'merging' => 90,
        ];

        $progress = 0;
        foreach ($stages as $stage => $percent) {
            $this->assertGreaterThan($progress, $percent);
            $progress = $percent;
        }

        $this->assertLessThanOrEqual(100, $progress);
    }

    public function test_media_job_can_be_canceled(): void
    {
        $job = new MediaJob([
            'id' => (string) Str::uuid(),
            'record_id' => 'test-record',
            'operation' => 'transcription',
            'status' => 'processing',
        ]);

        $job->status = 'canceled';

        $this->assertEquals('canceled', $job->status);
    }

    public function test_media_job_cancel_status_final(): void
    {
        $job = new MediaJob([
            'id' => (string) Str::uuid(),
            'record_id' => 'test-record',
            'operation' => 'transcription',
            'status' => 'canceled',
        ]);

        $isFinal = in_array($job->status, ['completed', 'failed', 'canceled'], true);
        $this->assertTrue($isFinal);
    }

    public function test_format_selection_in_options(): void
    {
        $job = new MediaJob([
            'id' => (string) Str::uuid(),
            'record_id' => 'test-record',
            'operation' => 'transcription',
            'options' => [
                'device' => 'gpu',
                'outputFormats' => ['srt', 'vtt'],
            ],
        ]);

        $this->assertEquals('gpu', $job->options['device']);
        $this->assertContains('srt', $job->options['outputFormats']);
        $this->assertNotContains('ttml', $job->options['outputFormats']);
    }

    public function test_device_selection_in_options(): void
    {
        $devices = ['cpu', 'gpu', 'auto'];

        foreach ($devices as $device) {
            $job = new MediaJob([
                'id' => (string) Str::uuid(),
                'record_id' => 'test-record',
                'operation' => 'transcription',
                'options' => ['device' => $device],
            ]);

            $this->assertEquals($device, $job->options['device']);
        }
    }
}
