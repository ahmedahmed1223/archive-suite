<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use App\Models\MontageProject;
use App\Models\MontageProjectRevision;
use App\Models\User;
use Tests\TestCase;

class MontageContractShapeTest extends TestCase
{
    use RefreshDatabase;

    public function test_revision_persists_tracks_clips_and_source_version(): void
    {
        $user = User::factory()->create();
        $project = MontageProject::factory()->create();

        $revision = MontageProjectRevision::create([
            'montage_project_id' => $project->id,
            'revision_number' => 1,
            'created_by' => $user->id,
            'tracks' => [['id' => 't1', 'kind' => 'video']],
            'clips' => [[
                'id' => 'c1',
                'trackId' => 't1',
                'source' => ['recordId' => 'r1', 'sourceVersionToken' => 'sha256:one'],
                'timelineStart' => 0,
                'sourceIn' => 0,
                'sourceOut' => 10,
            ]],
            'effects' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
        ]);

        $this->assertDatabaseHas('montage_project_revisions', [
            'id' => $revision->id,
            'revision_number' => 1,
            'source_version_token' => 'sha256:one',
        ]);
        $this->assertSame(1, $project->revisions()->count());
    }

    public function test_montage_revision_is_immutable_after_create(): void
    {
        $user = User::factory()->create();
        $project = MontageProject::factory()->create();
        $revision = MontageProjectRevision::create([
            'montage_project_id' => $project->id,
            'revision_number' => 1,
            'created_by' => $user->id,
            'tracks' => [],
            'clips' => [['sourceVersionToken' => 'sha256:one']],
            'effects' => [], 'markers' => [], 'comments' => [], 'transitions' => [],
        ]);

        $this->expectException(LogicException::class);
        $revision->update(['clips' => []]);
    }

    public function test_active_revision_returns_latest_by_number(): void
    {
        $user = User::factory()->create();
        $project = MontageProject::factory()->create();
        foreach ([1, 2, 3] as $n) {
            MontageProjectRevision::create([
                'montage_project_id' => $project->id,
                'revision_number' => $n,
                'created_by' => $user->id,
                'tracks' => [], 'clips' => [],
                'effects' => [], 'markers' => [], 'comments' => [], 'transitions' => [],
            ]);
        }

        $this->assertSame(3, $project->activeRevision()->revision_number);
        // The counter is owned by the revision service; direct model writes
        // create history rows without touching it.
        $this->assertSame(3, $project->revisions()->count());
    }
}
