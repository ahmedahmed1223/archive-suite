<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class MediaInspectionsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_a_completed_probe_is_persisted_and_readable_for_its_current_record_version(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'video-archive-1',
            'data' => json_encode([
                'id' => 'video-archive-1',
                'title' => 'النشرة المسائية',
                'checksum' => 'source-checksum-1',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'video-archive-1',
            'operation' => 'media_probe',
            'sourcePath' => 'ingest/video-archive-1.mov',
        ], $this->authHeaders())->assertAccepted();

        $this->getJson('/api/v1/records/video-archive-1/media-inspections', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'inspections')
            ->assertJsonPath('inspections.0.inspectionType', 'probe')
            ->assertJsonPath('inspections.0.status', 'completed')
            ->assertJsonPath('inspections.0.versionToken', 'record:source-checksum-1')
            ->assertJsonPath('inspections.0.isCurrentVersion', true)
            ->assertJsonPath('inspections.0.report.formatNames.0', 'mov');
    }
}
