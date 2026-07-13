<?php

namespace Tests\Feature;

use App\Models\MontageProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MontageProjectsApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        // V1-102: write endpoints below require editor/admin; this suite exercises
        // the montage CRUD flow itself, not role restrictions, so use editor.
        $this->user = User::factory()->create(['role' => 'editor']);
        $this->actingAs($this->user);
    }

    public function test_list_montage_projects(): void
    {
        MontageProject::query()->create([
            'id' => 'proj-1',
            'name' => 'Test Project 1',
            'description' => 'First test project',
            'fps' => 25,
            'tracks' => [
                ['id' => 'track-1', 'type' => 'video', 'name' => 'Video', 'order' => 0],
            ],
            'clips' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
            'status' => 'draft',
        ]);

        MontageProject::query()->create([
            'id' => 'proj-2',
            'name' => 'Test Project 2',
            'description' => 'Second test project',
            'fps' => 30,
            'tracks' => [],
            'clips' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
            'status' => 'finalized',
        ]);

        $response = $this->getJson('/api/v1/montage-projects');

        $response->assertOk();
        $response->assertJsonStructure([
            'ok',
            'projects' => [
                '*' => [
                    'id',
                    'name',
                    'description',
                    'fps',
                    'tracks',
                    'clips',
                    'markers',
                    'comments',
                    'transitions',
                    'status',
                    'createdAt',
                    'updatedAt',
                ],
            ],
        ]);
    }

    public function test_list_montage_projects_filters_by_status(): void
    {
        MontageProject::query()->create([
            'id' => 'proj-1',
            'name' => 'Draft',
            'fps' => 25,
            'tracks' => [],
            'clips' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
            'status' => 'draft',
        ]);

        MontageProject::query()->create([
            'id' => 'proj-2',
            'name' => 'Finalized',
            'fps' => 25,
            'tracks' => [],
            'clips' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
            'status' => 'finalized',
        ]);

        $response = $this->getJson('/api/v1/montage-projects?status=finalized');

        $response->assertOk();
        $response->assertJsonCount(1, 'projects');
        $response->assertJsonPath('projects.0.name', 'Finalized');
    }

    public function test_list_signals_more_projects_exist_beyond_the_page_limit(): void
    {
        for ($i = 0; $i < 4; $i++) {
            MontageProject::query()->create([
                'id' => "proj-more-{$i}",
                'name' => "Project {$i}",
                'fps' => 25,
                'tracks' => [],
                'clips' => [],
                'markers' => [],
                'comments' => [],
                'transitions' => [],
                'status' => 'draft',
                'updated_at' => now()->addSeconds($i),
            ]);
        }

        $response = $this->getJson('/api/v1/montage-projects?status=draft&limit=3');

        $response->assertOk();
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('pagination.total', 4);
        $response->assertJsonPath('pagination.limit', 3);
        $response->assertJsonPath('pagination.page', 1);
        $response->assertJsonPath('pagination.hasMore', true);
        $response->assertJsonCount(3, 'projects');
    }

    public function test_get_montage_project(): void
    {
        $project = MontageProject::query()->create([
            'id' => 'proj-123',
            'name' => 'Test Project',
            'description' => 'A test montage project',
            'fps' => 25,
            'tracks' => [
                ['id' => 'track-1', 'type' => 'video', 'name' => 'Video', 'order' => 0],
                ['id' => 'track-2', 'type' => 'audio', 'name' => 'Audio', 'order' => 1],
            ],
            'clips' => [
                ['id' => 'clip-1', 'itemId' => 'item-1', 'title' => 'Clip 1', 'trackId' => 'track-1', 'timelineStartSec' => 0, 'inSec' => 0, 'outSec' => 5],
            ],
            'markers' => [
                ['id' => 'marker-1', 'timeSec' => 2.5, 'label' => 'Intro', 'color' => '#FF0000'],
            ],
            'comments' => [],
            'transitions' => [],
            'status' => 'draft',
        ]);

        $response = $this->getJson("/api/v1/montage-projects/{$project->id}");

        $response->assertOk();
        $response->assertJsonPath('project.id', 'proj-123');
        $response->assertJsonPath('project.name', 'Test Project');
        $response->assertJsonPath('project.description', 'A test montage project');
        $response->assertJsonPath('project.fps', 25);
        $response->assertJsonCount(2, 'project.tracks');
        $response->assertJsonCount(1, 'project.clips');
        $response->assertJsonCount(1, 'project.markers');
    }

    public function test_get_nonexistent_montage_project(): void
    {
        $response = $this->getJson('/api/v1/montage-projects/nonexistent-id');

        $response->assertNotFound();
        $response->assertJsonPath('ok', false);
    }

    public function test_create_montage_project(): void
    {
        $payload = [
            'name' => 'New Montage',
            'description' => 'A brand new montage',
            'fps' => 30,
            'tracks' => [
                ['id' => 'track-1', 'type' => 'video', 'name' => 'Video', 'order' => 0],
            ],
            'clips' => [
                ['id' => 'clip-1', 'itemId' => 'item-1', 'title' => 'First Clip', 'trackId' => 'track-1', 'timelineStartSec' => 0, 'inSec' => 0, 'outSec' => 10],
            ],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
        ];

        $response = $this->postJson('/api/v1/montage-projects', $payload);

        $response->assertCreated();
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('project.name', 'New Montage');
        $response->assertJsonPath('project.description', 'A brand new montage');
        $response->assertJsonPath('project.fps', 30);
        $response->assertJsonPath('project.status', 'draft');

        $this->assertDatabaseHas('montage_projects', [
            'name' => 'New Montage',
            'description' => 'A brand new montage',
        ]);
    }

    public function test_create_montage_project_minimal(): void
    {
        $response = $this->postJson('/api/v1/montage-projects', [
            'name' => 'Minimal Project',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('project.name', 'Minimal Project');
        $response->assertJsonPath('project.fps', 25);
        $response->assertJsonPath('project.status', 'draft');
    }

    public function test_create_montage_project_validation(): void
    {
        $response = $this->postJson('/api/v1/montage-projects', [
            // missing required 'name'
        ]);

        $response->assertUnprocessable();
    }

    public function test_update_montage_project(): void
    {
        $project = MontageProject::query()->create([
            'id' => 'proj-update',
            'name' => 'Original Name',
            'description' => 'Original description',
            'fps' => 25,
            'tracks' => [],
            'clips' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
            'status' => 'draft',
        ]);

        $response = $this->putJson("/api/v1/montage-projects/{$project->id}", [
            'name' => 'Updated Name',
            'fps' => 30,
            'status' => 'finalized',
            'markers' => [
                ['id' => 'marker-1', 'timeSec' => 5, 'label' => 'New Marker'],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('project.name', 'Updated Name');
        $response->assertJsonPath('project.fps', 30);
        $response->assertJsonPath('project.status', 'finalized');
        $response->assertJsonCount(1, 'project.markers');

        $this->assertDatabaseHas('montage_projects', [
            'id' => 'proj-update',
            'name' => 'Updated Name',
        ]);
    }

    public function test_update_nonexistent_montage_project(): void
    {
        $response = $this->putJson('/api/v1/montage-projects/nonexistent-id', [
            'name' => 'Updated',
        ]);

        $response->assertNotFound();
    }

    public function test_delete_montage_project(): void
    {
        $project = MontageProject::query()->create([
            'id' => 'proj-delete',
            'name' => 'To Delete',
            'fps' => 25,
            'tracks' => [],
            'clips' => [],
            'markers' => [],
            'comments' => [],
            'transitions' => [],
            'status' => 'draft',
        ]);

        $response = $this->deleteJson("/api/v1/montage-projects/{$project->id}");

        $response->assertOk();
        $response->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('montage_projects', [
            'id' => 'proj-delete',
        ]);
    }

    public function test_delete_nonexistent_montage_project(): void
    {
        $response = $this->deleteJson('/api/v1/montage-projects/nonexistent-id');

        $response->assertNotFound();
    }

    public function test_montage_project_with_clips_and_transitions(): void
    {
        $project = MontageProject::query()->create([
            'id' => 'proj-complex',
            'name' => 'Complex Montage',
            'fps' => 25,
            'tracks' => [
                ['id' => 'v1', 'type' => 'video', 'name' => 'Main', 'order' => 0],
                ['id' => 'a1', 'type' => 'audio', 'name' => 'Music', 'order' => 1],
            ],
            'clips' => [
                ['id' => 'c1', 'itemId' => 'i1', 'title' => 'Shot A', 'trackId' => 'v1', 'timelineStartSec' => 0, 'inSec' => 0, 'outSec' => 5],
                ['id' => 'c2', 'itemId' => 'i2', 'title' => 'Shot B', 'trackId' => 'v1', 'timelineStartSec' => 5, 'inSec' => 0, 'outSec' => 3],
            ],
            'markers' => [
                ['id' => 'm1', 'timeSec' => 2, 'label' => 'Start', 'color' => '#FF0000'],
            ],
            'comments' => [
                ['id' => 'cmt1', 'clipId' => 'c1', 'text' => 'Great shot', 'createdAt' => now()->toISOString()],
            ],
            'transitions' => [
                ['id' => 't1', 'fromClipId' => 'c1', 'toClipId' => 'c2', 'type' => 'fade', 'durationSec' => 0.5],
            ],
            'status' => 'draft',
        ]);

        $response = $this->getJson("/api/v1/montage-projects/{$project->id}");

        $response->assertOk();
        $response->assertJsonCount(2, 'project.tracks');
        $response->assertJsonCount(2, 'project.clips');
        $response->assertJsonCount(1, 'project.markers');
        $response->assertJsonCount(1, 'project.comments');
        $response->assertJsonCount(1, 'project.transitions');
        $response->assertJsonPath('project.transitions.0.type', 'fade');
        $response->assertJsonPath('project.transitions.0.durationSec', 0.5);
    }
}
