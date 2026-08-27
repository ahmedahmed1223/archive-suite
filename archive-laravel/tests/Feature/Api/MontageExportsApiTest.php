<?php

namespace Tests\Feature\Api;

use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Models\MontageProject;
use App\Models\MontageProjectRevision;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class MontageExportsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_export_dispatches_one_media_workflow_with_a_server_resolved_manifest(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'editor']);
        [$project, $revision] = $this->projectWithRevision($owner);

        $response = $this->actingAs($owner)->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ])->assertCreated()
            ->assertJsonPath('revisionId', $revision->id)
            ->assertJsonPath('status', 'queued');

        $exportId = $response->json('id');
        $mediaJob = MediaJob::query()->where('options->exportId', $exportId)->first();
        $this->assertNotNull($mediaJob);
        $this->assertSame('montage_export', $mediaJob->operation);
        $this->assertSame('media/source.mov', $mediaJob->options['clips'][0]['path']);
        Queue::assertPushedOn('default', ProcessMediaWorkflow::class, fn (ProcessMediaWorkflow $job): bool => $job->mediaJobId === $mediaJob->id);
    }

    public function test_pre_export_qc_uses_the_export_manifest_checks_without_creating_work(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'editor']);
        [$project] = $this->projectWithRevision($owner);

        $this->actingAs($owner)
            ->postJson("/api/v1/montage-projects/{$project->id}/exports/qc", [
                'expectedRevision' => 1,
                'preset' => 'web-1080p',
            ])
            ->assertOk()
            ->assertJsonPath('ready', true)
            ->assertJsonPath('revisionNumber', 1);

        $this->assertDatabaseCount('montage_exports', 0);
        $this->assertDatabaseCount('media_jobs', 0);
        Queue::assertNothingPushed();
    }

    public function test_pre_queue_qc_rejects_insufficient_output_storage_as_structured_422(): void
    {
        Queue::fake();
        config(['media.montage_min_free_bytes' => PHP_INT_MAX]);
        $owner = User::factory()->create(['role' => 'editor']);
        [$project] = $this->projectWithRevision($owner);

        $this->actingAs($owner)->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ])->assertUnprocessable()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['errors' => ['storage']]);

        $this->assertDatabaseCount('montage_exports', 0);
        $this->assertDatabaseCount('media_jobs', 0);
        Queue::assertNothingPushed();
    }

    public function test_pre_queue_qc_rejects_non_numeric_clip_ranges_as_structured_422(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'editor']);
        [$project, $revision] = $this->projectWithRevision($owner);
        $clips = $revision->clips;
        $clips[0]['sourceIn'] = 'not-a-number';
        DB::table('montage_project_revisions')->where('id', $revision->id)->update([
            'clips' => json_encode($clips, JSON_THROW_ON_ERROR),
        ]);

        $this->actingAs($owner)->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['errors' => ['clips.0.sourceIn']]);

        $this->assertDatabaseCount('media_jobs', 0);
        Queue::assertNothingPushed();
    }

    public function test_pre_queue_qc_rejects_requested_audio_and_subtitle_tracks_without_sources(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'editor']);
        [$project, $revision] = $this->projectWithRevision($owner);
        DB::table('montage_project_revisions')->where('id', $revision->id)->update([
            'tracks' => json_encode([
                ['id' => 'video-1', 'kind' => 'video'],
                ['id' => 'audio-1', 'kind' => 'audio', 'required' => true],
                ['id' => 'subtitle-1', 'kind' => 'subtitle', 'required' => true],
            ], JSON_THROW_ON_ERROR),
        ]);

        $this->actingAs($owner)->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['errors' => ['tracks.audio-1', 'tracks.subtitle-1']]);

        $this->assertDatabaseCount('media_jobs', 0);
        Queue::assertNothingPushed();
    }

    public function test_export_rejects_a_client_media_path_in_the_pinned_revision(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'editor']);
        [$project, $revision] = $this->projectWithRevision($owner);
        $clips = $revision->clips;
        $clips[0]['source']['path'] = '../../private/source.mov';
        DB::table('montage_project_revisions')->where('id', $revision->id)->update([
            'clips' => json_encode($clips, JSON_THROW_ON_ERROR),
        ]);

        $this->actingAs($owner)->postJson("/api/v1/montage-projects/{$project->id}/exports", [
            'expectedRevision' => 1,
            'preset' => 'web-1080p',
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['errors' => ['clips.0.source']]);

        $this->assertDatabaseCount('media_jobs', 0);
        Queue::assertNothingPushed();
    }

    public function test_duplicate_export_requests_reuse_one_durable_job_with_a_database_idempotency_key(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'editor']);
        [$project] = $this->projectWithRevision($owner);
        $payload = ['expectedRevision' => 1, 'preset' => 'web-1080p'];

        $first = $this->actingAs($owner)
            ->postJson("/api/v1/montage-projects/{$project->id}/exports", $payload)
            ->assertCreated();
        $second = $this->actingAs($owner)
            ->postJson("/api/v1/montage-projects/{$project->id}/exports", $payload)
            ->assertCreated();

        $this->assertSame($first->json('id'), $second->json('id'));
        $this->assertDatabaseCount('montage_exports', 1);
        $this->assertDatabaseCount('media_jobs', 1);
        $export = DB::table('montage_exports')->where('id', $first->json('id'))->first();
        $this->assertNotNull($export->idempotency_key ?? null);
        $this->assertNotNull($export->media_job_id ?? null);
        Queue::assertPushedOnce(ProcessMediaWorkflow::class);
    }

    /** @return array{MontageProject, MontageProjectRevision} */
    private function projectWithRevision(User $owner): array
    {
        Storage::fake('local');
        Storage::disk('local')->put('media/source.mov', 'source-content');
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'record-export-source',
            'data' => json_encode([
                'fileName' => 'source.mov',
                'filePath' => 'media/source.mov',
                'checksum' => 'source-checksum',
                'mimeType' => 'video/quicktime',
                'sizeBytes' => 14,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $project = MontageProject::factory()->create([
            'owner_id' => $owner->id,
            'revision' => 1,
        ]);
        $revision = MontageProjectRevision::query()->create([
            'montage_project_id' => $project->id,
            'revision_number' => 1,
            'created_by' => $owner->id,
            'tracks' => [['id' => 'video-1', 'kind' => 'video']],
            'clips' => [[
                'id' => (string) Str::uuid(),
                'trackId' => 'video-1',
                'source' => [
                    'recordId' => 'record-export-source',
                    'sourceVersionToken' => 'record:source-checksum',
                ],
                'timelineStart' => 0,
                'sourceIn' => 0,
                'sourceOut' => 5,
            ]],
            'effects' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
            'source_version_token' => 'record:source-checksum',
        ]);
        $project->forceFill(['active_revision_id' => $revision->id])->save();

        return [$project->fresh(), $revision];
    }
}
