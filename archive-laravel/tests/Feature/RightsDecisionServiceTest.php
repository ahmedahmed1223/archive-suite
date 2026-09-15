<?php

namespace Tests\Feature;

use App\Models\RightsRecord;
use App\Models\RightsWindow;
use App\Services\RightsDecisionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RightsDecisionServiceTest extends TestCase
{
    use RefreshDatabase;

    private RightsDecisionService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new RightsDecisionService();
    }

    /**
     * Test 1: No rights record should be denied with the deny-by-default reason
     */
    public function test_no_rights_record_is_denied(): void
    {
        $decision = $this->service->decide(
            record: null,
            usage: 'broadcast',
            territory: 'US',
            platform: 'web',
            requestTime: Carbon::now(),
        );

        $this->assertFalse($decision->allowed);
        $this->assertStringContainsString('لا توجد بيانات حقوق مسجّلة', $decision->reason);
        $this->assertEquals('no_record', $decision->decidedBy);
    }

    /**
     * Test 2: A granted, currently-valid window with matching territory and platform is allowed
     */
    public function test_granted_valid_window_with_matching_criteria_is_allowed(): void
    {
        $record = RightsRecord::factory()->create();

        $window = RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'broadcast',
                'granted' => true,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => Carbon::now()->addDay(),
                'territories' => ['US', 'CA'],
                'platforms' => ['web', 'mobile'],
            ]);

        $decision = $this->service->decide(
            record: $record,
            usage: 'broadcast',
            territory: 'US',
            platform: 'web',
            requestTime: Carbon::now(),
        );

        $this->assertTrue($decision->allowed);
        $this->assertStringContainsString('مُصرّح', $decision->reason);
        $this->assertEquals($window->id, $decision->decidedBy);
    }

    /**
     * Test 3: A territory outside the window's list is denied, and decidedBy names the window
     */
    public function test_territory_outside_window_list_is_denied(): void
    {
        $record = RightsRecord::factory()->create();

        $window = RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'broadcast',
                'granted' => true,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => Carbon::now()->addDay(),
                'territories' => ['US', 'CA'],
                'platforms' => ['web', 'mobile'],
            ]);

        $decision = $this->service->decide(
            record: $record,
            usage: 'broadcast',
            territory: 'DE',
            platform: 'web',
            requestTime: Carbon::now(),
        );

        $this->assertFalse($decision->allowed);
        $this->assertStringContainsString('لا تطابق', $decision->reason);
        $this->assertEquals($window->id, $decision->decidedBy);
    }

    /**
     * Test 4: A platform outside the window's list is denied
     */
    public function test_platform_outside_window_list_is_denied(): void
    {
        $record = RightsRecord::factory()->create();

        $window = RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'broadcast',
                'granted' => true,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => Carbon::now()->addDay(),
                'territories' => ['US', 'CA'],
                'platforms' => ['web', 'mobile'],
            ]);

        $decision = $this->service->decide(
            record: $record,
            usage: 'broadcast',
            territory: 'US',
            platform: 'tv',
            requestTime: Carbon::now(),
        );

        $this->assertFalse($decision->allowed);
        $this->assertStringContainsString('لا تطابق', $decision->reason);
        $this->assertEquals($window->id, $decision->decidedBy);
    }

    /**
     * Test 5: The same request flips from allowed to denied as the clock crosses ends_at
     * This is the time-travel test that proves the deadline is actually enforced
     */
    public function test_decision_flips_when_clock_crosses_ends_at(): void
    {
        $record = RightsRecord::factory()->create();

        $endTime = Carbon::now()->addHour();

        $window = RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'broadcast',
                'granted' => true,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => $endTime,
                'territories' => ['US'],
                'platforms' => ['web'],
            ]);

        // Just before the deadline → allowed
        $beforeDeadline = $endTime->copy()->subMinute();
        $decisionBefore = $this->service->decide(
            record: $record,
            usage: 'broadcast',
            territory: 'US',
            platform: 'web',
            requestTime: $beforeDeadline,
        );
        $this->assertTrue($decisionBefore->allowed);

        // Just after the deadline → denied
        $afterDeadline = $endTime->copy()->addMinute();
        $decisionAfter = $this->service->decide(
            record: $record,
            usage: 'broadcast',
            territory: 'US',
            platform: 'web',
            requestTime: $afterDeadline,
        );
        $this->assertFalse($decisionAfter->allowed);
        $this->assertEquals($window->id, $decisionAfter->decidedBy);
    }

    /**
     * Test 6: granted = false is denied and distinguishable from "no window at all"
     */
    public function test_granted_false_is_denied_and_distinguishable(): void
    {
        $record = RightsRecord::factory()->create();

        RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'broadcast',
                'granted' => false,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => Carbon::now()->addDay(),
                'territories' => ['US'],
                'platforms' => ['web'],
            ]);

        $decision = $this->service->decide(
            record: $record,
            usage: 'broadcast',
            territory: 'US',
            platform: 'web',
            requestTime: Carbon::now(),
        );

        $this->assertFalse($decision->allowed);
        // The reason should indicate "not granted" rather than "no window"
        $this->assertStringContainsString('لم تُمنح', $decision->reason);
    }

    /**
     * Test: Window with null ends_at (open-ended) is allowed indefinitely
     */
    public function test_open_ended_window_is_allowed_indefinitely(): void
    {
        $record = RightsRecord::factory()->create();

        RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'digital_public',
                'granted' => true,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => null,
                'territories' => ['US'],
                'platforms' => ['web'],
            ]);

        // Check far into the future
        $futureTime = Carbon::now()->addYears(5);
        $decision = $this->service->decide(
            record: $record,
            usage: 'digital_public',
            territory: 'US',
            platform: 'web',
            requestTime: $futureTime,
        );

        $this->assertTrue($decision->allowed);
    }

    /**
     * Test: Empty territories list means all territories are allowed
     */
    public function test_empty_territories_list_allows_any_territory(): void
    {
        $record = RightsRecord::factory()->create();

        RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'internal_archive',
                'granted' => true,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => Carbon::now()->addDay(),
                'territories' => [],
                'platforms' => ['web'],
            ]);

        $decision = $this->service->decide(
            record: $record,
            usage: 'internal_archive',
            territory: 'ANY_TERRITORY',
            platform: 'web',
            requestTime: Carbon::now(),
        );

        $this->assertTrue($decision->allowed);
    }

    /**
     * Test: Empty platforms list means all platforms are allowed
     */
    public function test_empty_platforms_list_allows_any_platform(): void
    {
        $record = RightsRecord::factory()->create();

        RightsWindow::factory()
            ->for($record)
            ->create([
                'usage' => 'editorial_reuse',
                'granted' => true,
                'starts_at' => Carbon::now()->subDay(),
                'ends_at' => Carbon::now()->addDay(),
                'territories' => ['US'],
                'platforms' => [],
            ]);

        $decision = $this->service->decide(
            record: $record,
            usage: 'editorial_reuse',
            territory: 'US',
            platform: 'ANY_PLATFORM',
            requestTime: Carbon::now(),
        );

        $this->assertTrue($decision->allowed);
    }
}
