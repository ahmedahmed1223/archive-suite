<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MediaInspection;
use App\Models\TimedDescriptionSegment;
use App\Services\Search\RecordMomentsService;
use App\Services\Search\TranscriptSearchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class RecordMomentsServiceTest extends TestCase
{
    use RefreshDatabase;

    private RecordMomentsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new RecordMomentsService(new TranscriptSearchService());
    }

    private const TRANSCRIPT = "00:00:05 --> 00:00:09\nالأرشيف الوطني يحفظ الوثائق\n\n00:01:30 --> 00:01:34\nمبنى الأرشيف القديم\n";

    private function segment(string $uid, int $startFrame, string $title): void
    {
        TimedDescriptionSegment::query()->create([
            'id' => (string) Str::uuid(),
            'record_id' => $uid,
            'start_frame' => $startFrame,
            'end_frame' => $startFrame + 100,
            'title' => $title,
        ]);
    }

    private function probeWithFrameRate(string $uid, int $numerator, int $denominator): void
    {
        MediaInspection::query()->create([
            'id' => (string) Str::uuid(),
            'record_store' => 'archive-items',
            'record_uid' => $uid,
            'inspection_type' => 'probe',
            'status' => 'completed',
            'version_token' => 'v1',
            'report' => ['streams' => [
                ['type' => 'audio', 'frameRate' => null],
                ['type' => 'video', 'frameRate' => ['numerator' => $numerator, 'denominator' => $denominator]],
            ]],
            'completed_at' => now(),
        ]);
    }

    public function test_transcript_match_returns_the_cue_exact_time(): void
    {
        $moments = $this->service->forRecord('archive-items', 'rec-1', self::TRANSCRIPT, 'الأرشيف');

        $this->assertNotEmpty($moments);
        $this->assertSame('transcript', $moments[0]['kind']);
        // The cue declares 00:00:05 -- exact, no conversion involved.
        $this->assertSame(5, $moments[0]['timestampSeconds']);
    }

    public function test_transcript_returns_every_matching_cue_not_only_the_first(): void
    {
        $moments = $this->service->forRecord('archive-items', 'rec-1', self::TRANSCRIPT, 'الأرشيف');

        $this->assertCount(2, $moments);
        $this->assertSame([5, 90], array_column($moments, 'timestampSeconds'));
    }

    public function test_segment_frames_convert_exactly_using_the_rational_frame_rate(): void
    {
        $this->segment('rec-2', 3000, 'لقطة المبنى القديم');
        // 29.97 fps, kept rational so it does not drift.
        $this->probeWithFrameRate('rec-2', 30000, 1001);

        $moments = $this->service->forRecord('archive-items', 'rec-2', null, 'المبنى');

        $this->assertCount(1, $moments);
        $this->assertSame('description', $moments[0]['kind']);
        // 3000 frames at 30000/1001 = 100.1 seconds -> 100.
        $this->assertSame(100, $moments[0]['timestampSeconds']);
    }

    public function test_a_different_frame_rate_yields_a_different_time(): void
    {
        $this->segment('rec-3', 3000, 'لقطة المبنى القديم');
        $this->probeWithFrameRate('rec-3', 25, 1);

        $moments = $this->service->forRecord('archive-items', 'rec-3', null, 'المبنى');

        // Same frame count, 25fps -> 120s. Proves the rate is actually applied
        // rather than a constant being assumed.
        $this->assertSame(120, $moments[0]['timestampSeconds']);
    }

    public function test_segment_without_a_known_frame_rate_gets_no_timestamp(): void
    {
        $this->segment('rec-4', 3000, 'لقطة المبنى القديم');
        // No probe inspection at all -- the frame rate is unknown.

        $moments = $this->service->forRecord('archive-items', 'rec-4', null, 'المبنى');

        $this->assertCount(1, $moments);
        $this->assertSame('description', $moments[0]['kind']);
        // The moment is still surfaced, but no time is invented for it.
        $this->assertNull($moments[0]['timestampSeconds']);
    }

    public function test_a_query_matching_nothing_returns_no_moments(): void
    {
        $this->segment('rec-5', 10, 'لقطة المبنى القديم');
        $this->probeWithFrameRate('rec-5', 25, 1);

        $this->assertSame([], $this->service->forRecord('archive-items', 'rec-5', self::TRANSCRIPT, 'زورخ'));
    }
}
