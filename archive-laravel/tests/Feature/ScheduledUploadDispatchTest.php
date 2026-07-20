<?php

namespace Tests\Feature;

use App\Console\Commands\DispatchScheduledUploads;
use App\Jobs\FinalizeScheduledUpload;
use App\Models\ScheduledUpload;
use Illuminate\Contracts\Bus\Dispatcher as BusDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

/**
 * V1-712 Task 4: uploads:dispatch-scheduled claims due scheduled uploads in
 * bounded batches (race-safe via ScheduledUploadState's atomic
 * compare-and-swap) and uploads:recover-scheduled returns expired claims to
 * 'scheduled' so a crashed/lost worker doesn't strand a row forever.
 */
class ScheduledUploadDispatchTest extends TestCase
{
    use RefreshDatabase;

    private function dueSchedule(array $overrides = []): ScheduledUpload
    {
        return ScheduledUpload::factory()->create(array_merge([
            'status' => 'scheduled',
            'scheduled_at' => now()->subMinute(),
            'version' => 1,
        ], $overrides));
    }

    public function test_two_dispatcher_invocations_dispatch_each_due_id_once(): void
    {
        Queue::fake();

        $schedules = ScheduledUpload::factory()->count(3)->create([
            'status' => 'scheduled',
            'scheduled_at' => now()->subMinute(),
            'version' => 1,
        ]);

        Artisan::call('uploads:dispatch-scheduled');
        Artisan::call('uploads:dispatch-scheduled');

        Queue::assertPushedTimes(FinalizeScheduledUpload::class, 3);

        foreach ($schedules as $schedule) {
            Queue::assertPushed(
                FinalizeScheduledUpload::class,
                fn (FinalizeScheduledUpload $job): bool => $job->scheduleId === $schedule->id,
            );
            $this->assertSame('claimed', $schedule->refresh()->status);
        }
    }

    public function test_future_rows_remain_untouched(): void
    {
        Queue::fake();

        $future = $this->dueSchedule(['scheduled_at' => now()->addDay()]);

        Artisan::call('uploads:dispatch-scheduled');

        Queue::assertNotPushed(FinalizeScheduledUpload::class);
        $this->assertSame('scheduled', $future->refresh()->status);
    }

    public function test_batch_is_exactly_one_hundred(): void
    {
        Queue::fake();

        ScheduledUpload::factory()->count(150)->create([
            'status' => 'scheduled',
            'scheduled_at' => now()->subMinute(),
            'version' => 1,
        ]);

        Artisan::call('uploads:dispatch-scheduled');

        Queue::assertPushedTimes(FinalizeScheduledUpload::class, 100);
        $this->assertSame(100, ScheduledUpload::query()->where('status', 'claimed')->count());
        $this->assertSame(50, ScheduledUpload::query()->where('status', 'scheduled')->count());
    }

    public function test_depth_ceiling_dispatches_none(): void
    {
        Queue::fake();
        config(['scheduled-uploads.dispatch_queue_depth_ceiling' => 1]);

        ScheduledUpload::factory()->create(['status' => 'processing', 'version' => 1]);
        $due = $this->dueSchedule();

        Artisan::call('uploads:dispatch-scheduled');

        Queue::assertNotPushed(FinalizeScheduledUpload::class);
        $this->assertSame('scheduled', $due->refresh()->status);
    }

    public function test_failed_push_releases_the_claim_back_to_scheduled(): void
    {
        $due = $this->dueSchedule();

        $this->mock(BusDispatcher::class, function ($mock): void {
            $mock->shouldReceive('dispatch')->once()->andThrow(new RuntimeException('queue connection unavailable'));
        });

        Artisan::call('uploads:dispatch-scheduled');

        $due->refresh();
        $this->assertSame('scheduled', $due->status);
        // 1 (initial) -> 2 (claimed) -> 3 (released back to scheduled).
        $this->assertSame(3, $due->version);
    }

    public function test_expired_lease_returns_to_scheduled(): void
    {
        $expired = ScheduledUpload::factory()->create([
            'status' => 'claimed',
            'lease_expires_at' => now()->subMinute(),
            'version' => 2,
        ]);
        $notYetExpired = ScheduledUpload::factory()->create([
            'status' => 'claimed',
            'lease_expires_at' => now()->addMinute(),
            'version' => 2,
        ]);

        Artisan::call('uploads:recover-scheduled');

        $this->assertSame('scheduled', $expired->refresh()->status);
        $this->assertNull($expired->lease_expires_at);
        $this->assertSame('claimed', $notYetExpired->refresh()->status);
    }

    public function test_dispatch_writes_a_heartbeat_the_health_endpoint_can_read(): void
    {
        Queue::fake();
        $this->assertNull(Cache::get(DispatchScheduledUploads::HEARTBEAT_CACHE_KEY));

        Artisan::call('uploads:dispatch-scheduled');

        $this->assertNotNull(Cache::get(DispatchScheduledUploads::HEARTBEAT_CACHE_KEY));
    }

    public function test_health_endpoint_reports_scheduler_fresh_after_a_recent_dispatch(): void
    {
        Queue::fake();
        Artisan::call('uploads:dispatch-scheduled');

        $response = $this->getJson('/api/v1/health');

        $response->assertOk();
        $response->assertJsonPath('scheduledUploads.schedulerFresh', true);
        $response->assertJsonPath('degraded', false);
    }

    public function test_health_endpoint_degrades_when_the_dispatcher_heartbeat_is_stale(): void
    {
        Cache::put(
            DispatchScheduledUploads::HEARTBEAT_CACHE_KEY,
            now()->subMinutes(5)->toIso8601String(),
            now()->addMinutes(10),
        );

        $response = $this->getJson('/api/v1/health');

        $response->assertOk();
        $response->assertJsonPath('scheduledUploads.schedulerFresh', false);
        $response->assertJsonPath('degraded', true);
    }

    public function test_health_endpoint_degrades_when_the_oldest_due_upload_exceeds_the_threshold(): void
    {
        Cache::put(DispatchScheduledUploads::HEARTBEAT_CACHE_KEY, now()->toIso8601String(), now()->addMinutes(10));
        config(['scheduled-uploads.health_oldest_due_threshold_seconds' => 60]);
        $this->dueSchedule(['scheduled_at' => now()->subMinutes(10)]);

        $response = $this->getJson('/api/v1/health');

        $response->assertOk();
        $response->assertJsonPath('scheduledUploads.schedulerFresh', true);
        $response->assertJsonPath('degraded', true);
        $this->assertGreaterThanOrEqual(590, $response->json('scheduledUploads.oldestDueSeconds'));
    }

    public function test_health_endpoint_reports_in_flight_queue_depth(): void
    {
        Cache::put(DispatchScheduledUploads::HEARTBEAT_CACHE_KEY, now()->toIso8601String(), now()->addMinutes(10));
        ScheduledUpload::factory()->count(2)->create(['status' => 'claimed', 'version' => 1]);
        ScheduledUpload::factory()->create(['status' => 'processing', 'version' => 1]);
        ScheduledUpload::factory()->create(['status' => 'completed', 'version' => 1]);

        $response = $this->getJson('/api/v1/health');

        $response->assertJsonPath('scheduledUploads.queueDepth', 3);
    }
}
