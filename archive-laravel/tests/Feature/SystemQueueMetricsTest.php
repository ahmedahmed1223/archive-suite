<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Services\System\SystemMetricsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * V1-760: per-queue breakdown for the background queue health dashboard.
 *
 * `queueDepth` was one COUNT(*) over `jobs`, which cannot tell a stalled
 * ingest queue from a busy media queue. The `jobs` table already carries a
 * `queue` column, so the breakdown needs no new storage — only a group-by.
 */
final class SystemQueueMetricsTest extends TestCase
{
    use RefreshDatabase;

    private function pushJob(string $queue, int $createdAt): void
    {
        DB::table('jobs')->insert([
            'queue' => $queue,
            'payload' => '{}',
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => $createdAt,
            'created_at' => $createdAt,
        ]);
    }

    private function failJob(string $queue): void
    {
        DB::table('failed_jobs')->insert([
            'uuid' => (string) Str::uuid(),
            'connection' => 'database',
            'queue' => $queue,
            'payload' => '{}',
            'exception' => 'synthetic test failure',
            'failed_at' => now(),
        ]);
    }

    public function test_snapshot_reports_depth_per_queue_instead_of_one_aggregate(): void
    {
        $now = time();
        $this->pushJob('ingest', $now);
        $this->pushJob('ingest', $now);
        $this->pushJob('media', $now);

        $queues = collect((new SystemMetricsService())->snapshot()['queues']);

        $this->assertSame(2, $queues->firstWhere('name', 'ingest')['depth']);
        $this->assertSame(1, $queues->firstWhere('name', 'media')['depth']);
    }

    public function test_snapshot_reports_the_age_of_the_oldest_waiting_job(): void
    {
        // A shallow queue holding one wedged job is a dead worker, and only age
        // can reveal it — depth alone would read as healthy.
        $now = time();
        $this->pushJob('ingest', $now - 600);
        $this->pushJob('ingest', $now - 5);

        $ingest = collect((new SystemMetricsService())->snapshot()['queues'])->firstWhere('name', 'ingest');

        $this->assertGreaterThanOrEqual(600, $ingest['oldestJobAgeSec']);
        $this->assertLessThan(660, $ingest['oldestJobAgeSec']);
    }

    public function test_snapshot_counts_failed_jobs_against_their_own_queue(): void
    {
        $this->pushJob('media', time());
        $this->failJob('media');
        $this->failJob('media');
        $this->failJob('backups');

        $queues = collect((new SystemMetricsService())->snapshot()['queues']);

        $this->assertSame(2, $queues->firstWhere('name', 'media')['failed']);
        $this->assertSame(1, $queues->firstWhere('name', 'backups')['failed']);
    }

    public function test_a_queue_with_only_failures_still_appears(): void
    {
        // Dropping it because `jobs` is empty would hide exactly the queue that
        // needs attention.
        $this->failJob('backups');

        $backups = collect((new SystemMetricsService())->snapshot()['queues'])->firstWhere('name', 'backups');

        $this->assertNotNull($backups);
        $this->assertSame(0, $backups['depth']);
        $this->assertSame(1, $backups['failed']);
    }

    public function test_an_idle_queue_reports_zero_age_rather_than_a_stale_reading(): void
    {
        $this->failJob('backups');

        $backups = collect((new SystemMetricsService())->snapshot()['queues'])->firstWhere('name', 'backups');

        $this->assertSame(0, $backups['oldestJobAgeSec']);
    }

    public function test_snapshot_reports_no_queues_when_nothing_is_pending_or_failed(): void
    {
        $this->assertSame([], (new SystemMetricsService())->snapshot()['queues']);
    }

    public function test_aggregate_queue_depth_still_matches_the_sum_of_the_breakdown(): void
    {
        // queueDepth stays in the contract; the breakdown must agree with it or
        // the panel and the gauge would tell different stories.
        $now = time();
        $this->pushJob('ingest', $now);
        $this->pushJob('media', $now);
        $this->pushJob('media', $now);

        $snapshot = (new SystemMetricsService())->snapshot();

        $this->assertSame(3, $snapshot['queueDepth']);
        $this->assertSame(3, collect($snapshot['queues'])->sum('depth'));
    }

    public function test_admin_status_endpoint_exposes_the_queue_breakdown(): void
    {
        $this->pushJob('ingest', time());

        $this->getJson('/api/v1/system/status', $this->adminHeaders())
            ->assertOk()
            ->assertJsonStructure([
                'metrics' => ['queueDepth', 'queues' => [['name', 'depth', 'failed', 'oldestJobAgeSec']]],
            ]);
    }

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        $admin = User::query()->create([
            'name' => 'Queue Admin',
            'email' => 'status-queue-admin@example.test',
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
