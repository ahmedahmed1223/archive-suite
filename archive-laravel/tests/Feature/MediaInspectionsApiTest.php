<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\MediaInspection;
use App\Models\User;
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

    public function test_a_completed_qc_run_is_persisted_as_a_version_pinned_operational_result(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'video-qc-1',
            'data' => json_encode([
                'id' => 'video-qc-1',
                'title' => 'مادة اختبار الجودة',
                'checksum' => 'source-checksum-qc-1',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/media/jobs', [
            'recordId' => 'video-qc-1',
            'operation' => 'media_qc',
            'sourcePath' => 'ingest/video-qc-1.mov',
        ], $this->authHeaders())->assertAccepted();

        $this->getJson('/api/v1/records/video-qc-1/media-inspections', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'inspections')
            ->assertJsonPath('inspections.0.inspectionType', 'qc')
            ->assertJsonPath('inspections.0.status', 'passed')
            ->assertJsonPath('inspections.0.versionToken', 'record:source-checksum-qc-1')
            ->assertJsonPath('inspections.0.isCurrentVersion', true)
            ->assertJsonPath('inspections.0.report.findings.0.rule', 'decode');
    }

    public function test_only_an_admin_can_override_a_current_failed_qc_with_a_reason(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $editor = User::factory()->create(['role' => 'editor']);
        $inspection = MediaInspection::query()->create([
            'id' => 'qc-failed-1', 'record_store' => 'archive-items', 'record_uid' => 'video-qc-override',
            'inspection_type' => 'qc', 'status' => 'failed', 'version_token' => 'record:qc-override',
            'report' => ['status' => 'failed', 'findings' => []], 'completed_at' => now(),
        ]);
        DB::table('storage_rows')->insert(['store' => 'archive-items', 'uid' => 'video-qc-override', 'data' => json_encode(['id' => 'video-qc-override', 'checksum' => 'qc-override'], JSON_THROW_ON_ERROR), 'created_at' => now(), 'updated_at' => now()]);

        $this->actingAs($editor)->postJson("/api/v1/media-inspections/{$inspection->id}/override", ['reason' => 'Approved exception.'])->assertForbidden();
        $this->actingAs($admin)->postJson("/api/v1/media-inspections/{$inspection->id}/override", ['reason' => 'Approved exception.'])
            ->assertCreated()->assertJsonPath('ok', true)->assertJsonPath('override.inspectionId', $inspection->id);
        $this->assertDatabaseHas('media_qc_overrides', ['media_inspection_id' => $inspection->id, 'reason' => 'Approved exception.']);
        $this->assertSame('failed', $inspection->fresh()->status);
    }
}
