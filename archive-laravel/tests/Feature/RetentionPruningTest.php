<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ApiSession;
use App\Models\AuditLog;
use App\Models\MediaJob;
use App\Models\User;
use App\Services\Backup\DrReadinessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * V1-123: retention/pruning for sessions/audit/media-jobs/backups, plus
 * RPO/RTO reporting. Each prune command gets: an old row that must go, a
 * recent row that must survive, and (where relevant) an in-flight/protected
 * row that must survive regardless of age.
 */
class RetentionPruningTest extends TestCase
{
    use RefreshDatabase;

    // -- sessions:prune (api_sessions) ------------------------------------

    public function test_sessions_prune_deletes_only_fully_expired_rows(): void
    {
        $user = User::factory()->create();

        $expired = $this->makeApiSession($user->id, now()->subDays(30), now()->subDay());
        $stillRefreshable = $this->makeApiSession($user->id, now()->subHour(), now()->addDays(5));

        $this->artisan('sessions:prune')->assertExitCode(0);

        $this->assertModelMissing($expired);
        $this->assertModelExists($stillRefreshable);
    }

    // -- audit:prune --------------------------------------------------------

    public function test_audit_prune_deletes_only_entries_past_the_retention_window(): void
    {
        config(['archive.audit_log_retention_days' => 30]);

        $old = AuditLog::query()->create(['action' => 'old.event']);
        $old->forceFill(['created_at' => now()->subDays(31)])->save();

        $recent = AuditLog::query()->create(['action' => 'recent.event']);
        $recent->forceFill(['created_at' => now()->subDays(5)])->save();

        $this->artisan('audit:prune')->assertExitCode(0);

        $this->assertModelMissing($old);
        $this->assertModelExists($recent);
    }

    // -- media:prune-jobs -----------------------------------------------------

    public function test_media_prune_jobs_deletes_only_old_terminal_jobs(): void
    {
        config(['media.job_retention_days' => 30]);

        $oldCompleted = $this->makeMediaJob('old-completed', 'completed', now()->subDays(60));
        $oldFailed = $this->makeMediaJob('old-failed', 'failed', now()->subDays(45));
        $oldCanceled = $this->makeMediaJob('old-canceled', 'canceled', now()->subDays(90));

        $recentCompleted = $this->makeMediaJob('recent-completed', 'completed', now()->subDays(2));

        // Never pruned regardless of age — still in flight.
        $oldQueued = $this->makeMediaJob('old-queued', 'queued', null);
        $oldProcessing = $this->makeMediaJob('old-processing', 'processing', null);

        $this->artisan('media:prune-jobs')->assertExitCode(0);

        $this->assertModelMissing($oldCompleted);
        $this->assertModelMissing($oldFailed);
        $this->assertModelMissing($oldCanceled);
        $this->assertModelExists($recentCompleted);
        $this->assertModelExists($oldQueued);
        $this->assertModelExists($oldProcessing);
    }

    // -- backup:cleanup: never deletes the most recent backup -------------

    public function test_backup_cleanup_never_deletes_the_only_backup_even_if_old(): void
    {
        $dir = $this->tempBackupDir();
        config(['archive.backup_path' => $dir, 'archive.backups.max_count' => 30, 'archive.backups.max_age_days' => 1]);

        $onlyBackup = $this->writeFakeBackup($dir, 'backup-20200101000000.json.gz', now()->subYears(3));

        $this->artisan('backup:cleanup')->assertExitCode(0);

        $this->assertFileExists($onlyBackup);
    }

    public function test_backup_cleanup_keeps_the_newest_backups_up_to_max_count(): void
    {
        $dir = $this->tempBackupDir();
        config(['archive.backup_path' => $dir, 'archive.backups.max_count' => 1, 'archive.backups.max_age_days' => 9999]);

        $older = $this->writeFakeBackup($dir, 'backup-20200101000000.json.gz', now()->subDays(10));
        $newer = $this->writeFakeBackup($dir, 'backup-20250101000000.json.gz', now()->subDay());

        $this->artisan('backup:cleanup')->assertExitCode(0);

        $this->assertFileDoesNotExist($older);
        $this->assertFileExists($newer);
    }

    // -- RPO/RTO reporting --------------------------------------------------

    public function test_rpo_rto_report_reflects_backup_age_and_last_drill_duration(): void
    {
        $dir = $this->tempBackupDir();
        config(['archive.backup_path' => $dir]);

        $this->writeFakeBackup($dir, 'backup-20250101000000.json.gz', now()->subHours(4));

        $dr = $this->app->make(DrReadinessService::class);

        // No drill has run yet: RTO is explicitly "not yet measured".
        $report = $dr->rpoRtoReport();
        $this->assertEqualsWithDelta(4.0, $report['rpoHours'], 0.1);
        $this->assertNull($report['rtoSeconds']);

        // Simulate a recorded drill (avoids depending on DrDrillCommand's own
        // storage-table restore machinery here — that's covered separately).
        file_put_contents($dir.DIRECTORY_SEPARATOR.'dr-drill-status.json', json_encode([
            'status' => 'passed',
            'message' => 'DR drill passed: backup restored successfully.',
            'latestBackupName' => 'backup-20250101000000.json.gz',
            'drillAt' => now()->toIso8601String(),
            'passed' => true,
            'durationSeconds' => 12.5,
        ]));

        $report = $dr->rpoRtoReport();
        $this->assertSame(12.5, $report['rtoSeconds']);
        $this->assertStringContainsString('dr-drill', $report['rtoSource']);

        $this->artisan('dr:report')->assertExitCode(0);
    }

    // -- helpers --------------------------------------------------------------

    private function makeApiSession(int $userId, \DateTimeInterface $accessExpiresAt, \DateTimeInterface $refreshExpiresAt): ApiSession
    {
        return ApiSession::query()->create([
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'access_token_hash' => hash('sha256', Str::random(40)),
            'refresh_token_hash' => hash('sha256', Str::random(40)),
            'access_expires_at' => $accessExpiresAt,
            'refresh_expires_at' => $refreshExpiresAt,
        ]);
    }

    private function makeMediaJob(string $id, string $status, ?\DateTimeInterface $completedAt): MediaJob
    {
        return MediaJob::query()->create([
            'id' => $id,
            'record_id' => 'record-'.$id,
            'operation' => 'thumbnail',
            'status' => $status,
            'queued_at' => now()->subDays(200),
            'completed_at' => $completedAt,
        ]);
    }

    private function tempBackupDir(): string
    {
        $dir = sys_get_temp_dir().'/retention-pruning-test-'.uniqid();
        mkdir($dir, 0777, true);

        return $dir;
    }

    private function writeFakeBackup(string $dir, string $name, \DateTimeInterface $createdAt): string
    {
        $path = $dir.DIRECTORY_SEPARATOR.$name;
        file_put_contents($path, 'fake-backup-payload');
        touch($path, $createdAt instanceof \Carbon\Carbon ? $createdAt->getTimestamp() : $createdAt->getTimestamp());

        return $path;
    }
}
