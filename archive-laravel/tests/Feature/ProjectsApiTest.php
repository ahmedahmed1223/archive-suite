<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class ProjectsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_and_deletes_a_project(): void
    {
        $created = $this->postJson('/api/v1/projects', ['name' => 'مشروع التوثيق'], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('project.name', 'مشروع التوثيق');

        $id = $created->json('project.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/projects', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('projects.0.id', $id);

        $this->deleteJson('/api/v1/projects/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/projects', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'projects');
    }

    public function test_it_links_and_unlinks_a_record_without_moving_it(): void
    {
        $project = $this->postJson('/api/v1/projects', ['name' => 'مشروع أ'], $this->authHeaders())->json('project');

        $this->postJson('/api/v1/projects/'.$project['id'].'/records/item-1', [], $this->authHeaders())
            ->assertOk();

        $this->getJson('/api/v1/projects/'.$project['id'].'/records', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('recordIds.0', 'item-1');

        $this->getJson('/api/v1/records/item-1/projects', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('projects.0.id', $project['id']);

        $this->deleteJson('/api/v1/projects/'.$project['id'].'/records/item-1', [], $this->authHeaders())
            ->assertOk();

        $this->getJson('/api/v1/projects/'.$project['id'].'/records', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'recordIds');
    }

    public function test_deleting_a_project_also_removes_its_links(): void
    {
        $project = $this->postJson('/api/v1/projects', ['name' => 'مشروع أ'], $this->authHeaders())->json('project');
        $this->postJson('/api/v1/projects/'.$project['id'].'/records/item-1', [], $this->authHeaders())->assertOk();

        $this->deleteJson('/api/v1/projects/'.$project['id'], [], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/item-1/projects', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'projects');
    }

    public function test_it_rejects_an_empty_project_name(): void
    {
        $this->postJson('/api/v1/projects', ['name' => ''], $this->authHeaders())->assertStatus(422);
    }

    public function test_it_persists_project_notes_and_record_order(): void
    {
        $project = $this->postJson('/api/v1/projects', ['name' => 'إنتاج وثائقي', 'notes' => 'ملاحظات فريق التحرير'], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('project.notes', 'ملاحظات فريق التحرير')
            ->json('project');

        $this->postJson('/api/v1/projects/'.$project['id'].'/records/first', [], $this->authHeaders())->assertOk();
        $this->postJson('/api/v1/projects/'.$project['id'].'/records/second', [], $this->authHeaders())->assertOk();
        $this->putJson('/api/v1/projects/'.$project['id'].'/records/order', ['recordIds' => ['second', 'first']], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('recordIds.0', 'second')
            ->assertJsonPath('recordIds.1', 'first');

        $this->patchJson('/api/v1/projects/'.$project['id'], ['notes' => 'ملاحظات محدثة'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('project.notes', 'ملاحظات محدثة');
    }

    public function test_a_viewer_cannot_mutate_projects_or_their_record_links(): void
    {
        $project = $this->postJson('/api/v1/projects', ['name' => 'مشروع محمي'], $this->authHeaders())->json('project');
        $viewer = User::query()->create(['name' => 'Viewer', 'email' => 'viewer@example.test', 'password' => Hash::make('secret-password'), 'role' => 'viewer']);
        $viewerToken = $this->postJson('/api/v1/auth/login', ['email' => $viewer->email, 'password' => 'secret-password'])->assertOk()->json('accessToken');
        $headers = ['Authorization' => 'Bearer '.$viewerToken];

        $this->postJson('/api/v1/projects', ['name' => 'محظور'], $headers)->assertForbidden();
        $this->patchJson('/api/v1/projects/'.$project['id'], ['notes' => 'محظور'], $headers)->assertForbidden();
        $this->postJson('/api/v1/projects/'.$project['id'].'/records/record-1', [], $headers)->assertForbidden();
        $this->deleteJson('/api/v1/projects/'.$project['id'].'/records/record-1', [], $headers)->assertForbidden();
        $this->putJson('/api/v1/projects/'.$project['id'].'/records/order', ['recordIds' => []], $headers)->assertForbidden();
        $this->deleteJson('/api/v1/projects/'.$project['id'], [], $headers)->assertForbidden();
    }
}
