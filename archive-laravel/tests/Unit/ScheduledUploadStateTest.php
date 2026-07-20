<?php

namespace Tests\Unit;

use App\Exceptions\ScheduledUploadConflict;
use App\Models\ScheduledUpload;
use App\Services\Uploads\ScheduledUploadState;
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
}
