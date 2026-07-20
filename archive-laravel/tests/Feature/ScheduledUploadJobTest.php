<?php

namespace Tests\Feature;

use App\Jobs\FinalizeScheduledUpload;
use App\Models\ScheduledUpload;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * V1-712 Task 4: FinalizeScheduledUpload must be genuinely idempotent
 * against redelivery (no duplicate storage_rows row after record
 * association) and must fail terminally -- without throwing, so the queue
 * never retries -- for a checksum mismatch or a missing staged artifact.
 */
class ScheduledUploadJobTest extends TestCase
{
    use RefreshDatabase;

    private const CONTENT = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\npadding padding padding";

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('ingest.disk'));
    }

    private function stagedSchedule(array $overrides = []): ScheduledUpload
    {
        $editor = User::factory()->create(['role' => 'editor']);
        $disk = (string) config('ingest.disk');
        $path = 'ingest/quarantine/'.Str::uuid().'.pdf';
        Storage::disk($disk)->put($path, self::CONTENT);

        return ScheduledUpload::factory()->create(array_merge([
            'created_by' => $editor->id,
            'disk' => $disk,
            'file_name' => 'report.pdf',
            'staged_path' => $path,
            'total_size' => strlen(self::CONTENT),
            'checksum_sha256' => hash('sha256', self::CONTENT),
            'status' => 'claimed',
            'lease_expires_at' => now()->addMinutes(30),
            'version' => 2,
        ], $overrides));
    }

    private function runJob(ScheduledUpload $schedule): void
    {
        $job = new FinalizeScheduledUpload($schedule->id);
        app()->call([$job, 'handle']);
    }

    public function test_duplicate_job_after_record_association_does_not_create_a_second_storage_row(): void
    {
        $schedule = $this->stagedSchedule();

        $this->runJob($schedule);

        $schedule->refresh();
        $this->assertSame('completed', $schedule->status);
        $this->assertNotNull($schedule->record_id);
        $this->assertSame(1, DB::table('storage_rows')->where('uid', $schedule->record_id)->count());

        // Redelivery: the same job body runs again (e.g. a queue driver
        // redelivering after a slow ack). Must be a silent no-op.
        $this->runJob($schedule);

        $this->assertSame(1, DB::table('storage_rows')->where('uid', $schedule->record_id)->count());
        $this->assertSame('completed', $schedule->refresh()->status);
    }

    public function test_missing_artifact_fails_terminally_without_retrying(): void
    {
        $schedule = $this->stagedSchedule();
        Storage::disk($schedule->disk)->delete($schedule->staged_path);

        $this->runJob($schedule);

        $schedule->refresh();
        $this->assertSame('failed', $schedule->status);
        $this->assertSame('artifact_missing', $schedule->failure_code);
        $this->assertSame(0, DB::table('storage_rows')->count());
    }

    public function test_checksum_mismatch_fails_terminally_without_retrying(): void
    {
        $schedule = $this->stagedSchedule(['checksum_sha256' => hash('sha256', 'not the real content')]);

        $this->runJob($schedule);

        $schedule->refresh();
        $this->assertSame('failed', $schedule->status);
        $this->assertSame('checksum_mismatch', $schedule->failure_code);
        $this->assertSame(0, DB::table('storage_rows')->count());
    }

    /**
     * Simulates exhausted retries for a genuine (non-benign) failure: the
     * claimed->processing transition never went through, so the schedule is
     * still 'claimed' when failed() runs. failed()'s own transition to
     * 'failed' is illegal from 'claimed' (LEGAL['claimed'] doesn't include
     * it), so the failure_code/message never get persisted -- this must not
     * be swallowed silently, it must be logged.
     */
    public function test_failed_logs_a_warning_when_the_schedule_is_stuck_in_an_unfailable_status(): void
    {
        $schedule = $this->stagedSchedule(['status' => 'claimed']);

        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function (string $message, array $context) use ($schedule): bool {
                return str_contains($message, 'could not record the failure')
                    && $context['scheduleId'] === $schedule->id
                    && $context['status'] === 'claimed';
            });

        $job = new FinalizeScheduledUpload($schedule->id);
        $job->failed(new RuntimeException('Storage adapter unavailable.'));

        // The row is left exactly as it was -- illegal-transition conflict
        // means failed() could not persist anything onto it.
        $this->assertSame('claimed', $schedule->refresh()->status);
        $this->assertNull($schedule->failure_code);
    }
}
