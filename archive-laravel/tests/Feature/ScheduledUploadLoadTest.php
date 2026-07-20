<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\FinalizeScheduledUpload;
use App\Models\ScheduledUpload;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * V1-712 Task 9: proves the dispatcher's claim path (a single conditional
 * `UPDATE ... WHERE status = 'scheduled' AND version = ?` per row — see
 * DispatchScheduledUploads' docblock) stays race-safe and batch-bounded when
 * the due-candidate pool is large, not just when it's a handful of rows like
 * ScheduledUploadDispatchTest's fixtures.
 *
 * ponytail: the 5,000-row seed only exercises the claim/dispatch layer
 * (Queue::fake() — no real jobs run against it). Actually finalizing 5,000
 * rows would need 5,000 real staged Storage::fake() artifacts for no
 * additional signal on the thing this test is actually about (claim-race
 * safety at scale); FinalizeScheduledUpload's own idempotency is already
 * covered row-by-row in ScheduledUploadJobTest. The "every completed row has
 * a unique record id" requirement is instead proven against a smaller,
 * fully-staged sample (FINALIZE_SAMPLE_SIZE) run through the real job
 * synchronously. Raise the sample size if the finalize path itself ever
 * needs load coverage.
 */
class ScheduledUploadLoadTest extends TestCase
{
    use RefreshDatabase;

    private const DUE_COUNT = 5000;

    private const DISPATCH_INVOCATIONS = 10;

    private const FINALIZE_SAMPLE_SIZE = 25;

    public function test_ten_dispatch_batches_over_five_thousand_due_rows_never_double_claim_or_exceed_batch(): void
    {
        Queue::fake();

        ScheduledUpload::factory()->count(self::DUE_COUNT)->create([
            'status' => 'scheduled',
            'scheduled_at' => now()->subMinute(),
            'version' => 1,
        ]);

        $batch = (int) config('scheduled-uploads.batch', 100);
        $previousTotal = 0;

        for ($i = 0; $i < self::DISPATCH_INVOCATIONS; $i++) {
            Artisan::call('uploads:dispatch-scheduled');

            // Queue::pushed() returns the FULL history each call (fake queue doesn't
            // reset between invocations within a test) — diff against the running
            // total instead of re-scanning it as "this invocation's" pushes.
            $total = Queue::pushed(FinalizeScheduledUpload::class)->count();
            $pushedThisRun = $total - $previousTotal;
            $this->assertLessThanOrEqual($batch, $pushedThisRun, "dispatch invocation #{$i} claimed more than the configured batch");
            $previousTotal = $total;
        }

        $pushedIds = Queue::pushed(FinalizeScheduledUpload::class)
            ->map(fn (FinalizeScheduledUpload $job): string => $job->scheduleId)
            ->all();
        $this->assertSame(count($pushedIds), count(array_unique($pushedIds)), 'the same schedule id was claimed by more than one dispatch invocation');

        $claimedCount = ScheduledUpload::query()->where('status', 'claimed')->count();
        $this->assertSame(count($pushedIds), $claimedCount);
        $this->assertLessThanOrEqual(self::DISPATCH_INVOCATIONS * $batch, $claimedCount);

        // Untouched rows are exactly the ones never claimed — no row silently
        // vanished or got claimed without a corresponding pushed job.
        $stillScheduled = ScheduledUpload::query()->where('status', 'scheduled')->count();
        $this->assertSame(self::DUE_COUNT - $claimedCount, $stillScheduled);
    }

    public function test_finalized_rows_each_get_a_unique_record_id(): void
    {
        Storage::fake(config('ingest.disk'));
        $disk = (string) config('ingest.disk');
        $editor = User::factory()->create(['role' => 'editor']);

        $schedules = [];

        for ($i = 0; $i < self::FINALIZE_SAMPLE_SIZE; $i++) {
            $content = 'load-test-content-'.$i;
            $path = 'ingest/quarantine/'.Str::uuid().'.bin';
            Storage::disk($disk)->put($path, $content);

            $schedules[] = ScheduledUpload::factory()->create([
                'created_by' => $editor->id,
                'disk' => $disk,
                'file_name' => "load-{$i}.bin",
                'staged_path' => $path,
                'total_size' => strlen($content),
                'checksum_sha256' => hash('sha256', $content),
                'status' => 'claimed',
                'lease_expires_at' => now()->addMinutes(30),
                'version' => 2,
            ]);
        }

        foreach ($schedules as $schedule) {
            $job = new FinalizeScheduledUpload($schedule->id);
            app()->call([$job, 'handle']);
        }

        $recordIds = ScheduledUpload::query()->whereIn('id', array_map(fn (ScheduledUpload $s): string => $s->id, $schedules))
            ->pluck('record_id');

        $this->assertCount(self::FINALIZE_SAMPLE_SIZE, $recordIds);
        $this->assertTrue($recordIds->every(fn (?string $id): bool => $id !== null), 'every finalized schedule must carry a record id');
        $this->assertSame($recordIds->unique()->count(), $recordIds->count(), 'two schedules were finalized onto the same record id');
        $this->assertSame(self::FINALIZE_SAMPLE_SIZE, DB::table('storage_rows')->whereIn('uid', $recordIds)->count());
    }
}
