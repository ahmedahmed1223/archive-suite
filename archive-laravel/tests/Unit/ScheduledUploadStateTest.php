<?php

namespace Tests\Unit;

use App\Exceptions\ScheduledUploadConflict;
use App\Models\ScheduledUpload;
use App\Services\Uploads\ScheduledUploadState;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScheduledUploadStateTest extends TestCase
{
    use \Illuminate\Foundation\Testing\RefreshDatabase;

    public function test_only_legal_transitions_increment_version(): void
    {
        $schedule = ScheduledUpload::factory()->create(['status' => 'scheduled', 'version' => 1]);
        $updated = app(ScheduledUploadState::class)->transition($schedule->id, 'scheduled', 'claimed', 1);
        $this->assertSame('claimed', $updated->status);
        $this->assertSame(2, $updated->version);
    }

    public function test_stale_or_illegal_transition_conflicts(): void
    {
        $schedule = ScheduledUpload::factory()->create(['status' => 'processing', 'version' => 3]);
        $this->expectException(ScheduledUploadConflict::class);
        app(ScheduledUploadState::class)->transition($schedule->id, 'scheduled', 'cancelled', 2);
    }

    public function test_illegal_transition_reason_is_distinguishable(): void
    {
        $schedule = ScheduledUpload::factory()->create(['status' => 'completed', 'version' => 1]);
        try {
            app(ScheduledUploadState::class)->transition($schedule->id, 'completed', 'claimed', 1);
            $this->fail('Expected ScheduledUploadConflict to be thrown.');
        } catch (ScheduledUploadConflict $e) {
            $this->assertSame('illegal_transition', $e->reason);
        }
    }

    public function test_stale_version_reason_is_distinguishable(): void
    {
        $schedule = ScheduledUpload::factory()->create(['status' => 'scheduled', 'version' => 1]);
        try {
            app(ScheduledUploadState::class)->transition($schedule->id, 'scheduled', 'claimed', 99);
            $this->fail('Expected ScheduledUploadConflict to be thrown.');
        } catch (ScheduledUploadConflict $e) {
            $this->assertSame('stale_version', $e->reason);
        }
    }

    public function test_factory_auto_generates_uuid_when_id_omitted(): void
    {
        $schedule = ScheduledUpload::factory()->create();
        $this->assertNotEmpty($schedule->id);
        $this->assertTrue(Str::isUuid($schedule->id));
    }
}
