<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\SystemMetricSample;
use App\Models\User;
use App\Services\System\SystemMetricsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * V1-756: storage history. lib/storage-forecast.ts can fit a trend but the API
 * only ever exposed a point-in-time snapshot, so there was no series to fit.
 * This adds the sampler, its retention, and a bounded read endpoint.
 *
 * The sharp edge: SystemMetricsService::disk() returns 0/0 when the host read
 * fails. Storing that as a real sample would tell the forecast that storage
 * collapsed to zero and is now shrinking — an invented trend built from a
 * failure. A failed read must be skipped, not recorded.
 */
final class SystemMetricsHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function fakeMetrics(int $used, int $total): void
    {
        $this->instance(SystemMetricsService::class, new class($used, $total) extends SystemMetricsService
        {
            public function __construct(private int $used, private int $total) {}

            public function snapshot(): array
            {
                return [
                    'cpuLoad' => [0.0, 0.0, 0.0],
                    'memory' => ['usedBytes' => 1, 'totalBytes' => 2],
                    'disk' => ['usedBytes' => $this->used, 'totalBytes' => $this->total],
                    'queueDepth' => 0,
                    'queues' => [],
                ];
            }
        });
    }

    public function test_capture_records_one_sample_from_the_live_snapshot(): void
    {
        $this->fakeMetrics(4_000, 10_000);

        $this->artisan('metrics:capture')->assertExitCode(0);

        $this->assertSame(1, SystemMetricSample::query()->count());
        $sample = SystemMetricSample::query()->first();
        $this->assertSame(4_000, (int) $sample->disk_used_bytes);
        $this->assertSame(10_000, (int) $sample->disk_total_bytes);
    }

    public function test_capture_skips_an_unreadable_disk_instead_of_storing_a_zero_sample(): void
    {
        // 0/0 is how the service reports a failed host read. Recording it would
        // poison the forecast with a fabricated collapse to zero.
        $this->fakeMetrics(0, 0);

        $this->artisan('metrics:capture')->assertExitCode(0);

        $this->assertSame(0, SystemMetricSample::query()->count());
    }

    public function test_capture_appends_rather_than_replacing_so_a_series_accumulates(): void
    {
        $this->fakeMetrics(1_000, 10_000);
        $this->artisan('metrics:capture')->assertExitCode(0);

        $this->fakeMetrics(2_000, 10_000);
        $this->artisan('metrics:capture')->assertExitCode(0);

        $this->assertSame(2, SystemMetricSample::query()->count());
    }

    public function test_prune_deletes_samples_past_the_retention_window_and_keeps_the_rest(): void
    {
        config(['archive.metric_sample_retention_days' => 30]);

        SystemMetricSample::query()->create(['captured_at' => now()->subDays(45), 'disk_used_bytes' => 1, 'disk_total_bytes' => 10]);
        SystemMetricSample::query()->create(['captured_at' => now()->subDays(10), 'disk_used_bytes' => 2, 'disk_total_bytes' => 10]);

        $this->artisan('metrics:prune')->assertExitCode(0);

        // Retention that never runs is the same bug as no retention at all:
        // an hourly sampler grows the table forever.
        $this->assertSame(1, SystemMetricSample::query()->count());
        $this->assertSame(2, (int) SystemMetricSample::query()->first()->disk_used_bytes);
    }

    public function test_history_endpoint_returns_samples_oldest_first_for_an_admin(): void
    {
        SystemMetricSample::query()->create(['captured_at' => now()->subDays(2), 'disk_used_bytes' => 100, 'disk_total_bytes' => 500]);
        SystemMetricSample::query()->create(['captured_at' => now()->subDays(1), 'disk_used_bytes' => 200, 'disk_total_bytes' => 500]);

        $response = $this->getJson('/api/v1/system/metrics/history', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure(['samples' => [['at', 'usedBytes', 'totalBytes']]]);

        $samples = $response->json('samples');
        $this->assertCount(2, $samples);
        $this->assertSame(100, $samples[0]['usedBytes']);
        $this->assertSame(200, $samples[1]['usedBytes']);
    }

    public function test_history_endpoint_honours_the_requested_window(): void
    {
        SystemMetricSample::query()->create(['captured_at' => now()->subDays(40), 'disk_used_bytes' => 1, 'disk_total_bytes' => 10]);
        SystemMetricSample::query()->create(['captured_at' => now()->subDays(2), 'disk_used_bytes' => 2, 'disk_total_bytes' => 10]);

        $this->getJson('/api/v1/system/metrics/history?days=7', $this->adminHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'samples');
    }

    public function test_history_endpoint_clamps_an_absurd_window_rather_than_scanning_everything(): void
    {
        // An unbounded days= would let any admin table-scan the whole history.
        SystemMetricSample::query()->create(['captured_at' => now()->subDays(1), 'disk_used_bytes' => 1, 'disk_total_bytes' => 10]);
        $headers = $this->adminHeaders();

        foreach (['99999', '0', '-5', 'abc'] as $days) {
            $this->getJson("/api/v1/system/metrics/history?days={$days}", $headers)
                ->assertOk()
                ->assertJsonCount(1, 'samples');
        }
    }

    public function test_history_endpoint_is_admin_only(): void
    {
        $viewer = User::query()->create([
            'name' => 'Viewer',
            'email' => 'metrics-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $this->getJson('/api/v1/system/metrics/history', ['Authorization' => 'Bearer '.$this->tokenFor($viewer)])
            ->assertForbidden();
    }

    public function test_history_endpoint_rejects_an_anonymous_caller(): void
    {
        $this->getJson('/api/v1/system/metrics/history')->assertUnauthorized();
    }

    public function test_history_endpoint_returns_an_empty_series_before_any_sample_exists(): void
    {
        $this->getJson('/api/v1/system/metrics/history', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('samples', []);
    }

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        $admin = User::query()->create([
            'name' => 'Metrics Admin',
            'email' => 'metrics-admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    private function tokenFor(User $user): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return $login->json('accessToken');
    }
}
