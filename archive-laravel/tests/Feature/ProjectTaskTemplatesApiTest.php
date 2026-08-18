<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class ProjectTaskTemplatesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_lists_the_seeded_archive_review_and_production_templates(): void
    {
        $response = $this->getJson('/api/v1/project-task-templates', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(3, 'templates');

        $categories = collect($response->json('templates'))->pluck('category')->sort()->values()->all();
        $this->assertSame(['archive', 'production', 'review'], $categories);
    }

    public function test_it_filters_by_category(): void
    {
        $this->getJson('/api/v1/project-task-templates?category=production', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'templates')
            ->assertJsonPath('templates.0.category', 'production');
    }

    public function test_applying_a_template_copies_its_target_duration_into_a_normal_create_call(): void
    {
        $template = $this->getJson('/api/v1/project-task-templates?category=review', $this->authHeaders())
            ->json('templates.0');

        $project = $this->postJson('/api/v1/projects', ['name' => 'مشروع'], $this->authHeaders())->json('project');

        $created = $this->postJson('/api/v1/project-tasks', [
            'projectId' => $project['id'],
            'title' => $template['title'],
            'status' => $template['defaultStatus'],
            'targetDurationMinutes' => $template['targetDurationMinutes'],
        ], $this->authHeaders())->assertCreated();

        $this->assertSame($template['targetDurationMinutes'], $created->json('task.targetDurationMinutes'));
        $this->assertNotNull($created->json('task.targetDeadlineAt'));
    }

    public function test_an_editor_can_read_but_not_manage_the_template_catalog(): void
    {
        $this->getJson('/api/v1/project-task-templates', $this->authHeaders())->assertOk();

        $this->postJson('/api/v1/project-task-templates', [
            'category' => 'archive',
            'title' => 'Editor attempt',
        ], $this->authHeaders())->assertForbidden();
    }

    public function test_an_admin_can_create_update_and_delete_a_template(): void
    {
        $admin = $this->adminHeaders();

        $created = $this->postJson('/api/v1/project-task-templates', [
            'category' => 'production',
            'title' => 'Custom production template',
            'targetDurationMinutes' => 90,
        ], $admin)->assertCreated()->assertJsonPath('template.targetDurationMinutes', 90);

        $id = $created->json('template.id');

        $this->patchJson('/api/v1/project-task-templates/'.$id, ['title' => 'Renamed'], $admin)
            ->assertOk()->assertJsonPath('template.title', 'Renamed');

        $this->deleteJson('/api/v1/project-task-templates/'.$id, [], $admin)
            ->assertOk()->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/project-task-templates', $admin)->assertOk()->assertJsonCount(3, 'templates');
    }

    private function adminHeaders(): array
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'task-template-admin@example.test'],
            ['name' => 'Admin', 'password' => Hash::make('secret-password'), 'role' => 'admin'],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
