<?php

namespace Tests\Feature\Api;

use App\Models\MontageProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MontageRevisionsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_save_a_new_revision(): void
    {
        $owner = User::factory()->create(['role' => 'editor']);
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);

        $response = $this->actingAs($owner)
            ->postJson("/api/v1/montage-projects/{$project->id}/revision", [
                'expectedRevision' => 0,
                'tracks' => [['id' => 't1', 'kind' => 'video']],
                'clips' => [],
            ]);

        $response->assertCreated()
            ->assertJsonPath('revisionNumber', 1);
        $this->assertSame(1, $project->fresh()->revision);
    }

    public function test_stale_revision_returns_current_revision_without_overwriting(): void
    {
        $owner = User::factory()->create(['role' => 'editor']);
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        // Bring the project to revision 4 by saving four revisions.
        foreach ([0, 1, 2, 3] as $expected) {
            $this->actingAs($owner)
                ->postJson("/api/v1/montage-projects/{$project->id}/revision", [
                    'expectedRevision' => $expected,
                    'tracks' => [],
                    'clips' => [],
                ])->assertCreated();
        }

        $this->actingAs($owner)
            ->postJson("/api/v1/montage-projects/{$project->id}/revision", [
                'expectedRevision' => 3,
                'tracks' => [['id' => 'stale']],
                'clips' => [],
            ])
            ->assertStatus(409)
            ->assertJsonPath('currentRevision', 4);

        // The conflicting write must not create a fifth revision.
        $this->assertSame(4, $project->fresh()->revision);
    }

    public function test_owner_can_fetch_the_active_revision(): void
    {
        $owner = User::factory()->create(['role' => 'editor']);
        $project = MontageProject::factory()->create(['owner_id' => $owner->id]);
        $this->actingAs($owner)
            ->postJson("/api/v1/montage-projects/{$project->id}/revision", [
                'expectedRevision' => 0,
                'tracks' => [['id' => 't1', 'kind' => 'video']],
                'clips' => [],
            ])
            ->assertCreated();

        $this->actingAs($owner)
            ->getJson("/api/v1/montage-projects/{$project->id}/revision")
            ->assertOk()
            ->assertJsonPath('revisionNumber', 1)
            ->assertJsonPath('projectId', $project->id);
    }
}
