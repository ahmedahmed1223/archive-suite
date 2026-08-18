<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class AutomationRuleTemplatesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_lists_the_seeded_archive_review_and_production_templates(): void
    {
        $response = $this->getJson('/api/v1/automation/rule-templates', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(3, 'templates');

        $categories = collect($response->json('templates'))->pluck('category')->sort()->values()->all();
        $this->assertSame(['archive', 'production', 'review'], $categories);
    }

    public function test_it_filters_templates_by_category(): void
    {
        $this->getJson('/api/v1/automation/rule-templates?category=review', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'templates')
            ->assertJsonPath('templates.0.category', 'review');
    }

    public function test_applying_a_template_is_just_reading_its_fields_into_a_normal_create_call(): void
    {
        $template = $this->getJson('/api/v1/automation/rule-templates?category=archive', $this->authHeaders())
            ->json('templates.0');

        $created = $this->postJson('/api/v1/automation/rules', [
            'name' => 'From template: '.$template['name'],
            'trigger' => $template['trigger'],
            'action' => $template['action'],
        ], $this->authHeaders())->assertCreated();

        $this->assertSame($template['trigger'], $created->json('rule.trigger'));
        $this->assertSame($template['action'], $created->json('rule.action'));
    }

    public function test_an_editor_cannot_manage_the_template_catalog_but_can_read_it(): void
    {
        $this->getJson('/api/v1/automation/rule-templates', $this->authHeaders())->assertOk();

        $this->postJson('/api/v1/automation/rule-templates', [
            'category' => 'archive',
            'name' => 'Editor attempt',
            'trigger' => 'record.created',
            'action' => 'add-tag',
        ], $this->authHeaders())->assertForbidden();
    }

    public function test_an_admin_can_create_update_and_delete_a_template(): void
    {
        $admin = $this->adminHeaders();

        $created = $this->postJson('/api/v1/automation/rule-templates', [
            'category' => 'production',
            'name' => 'Custom production template',
            'description' => 'Admin-authored preset.',
            'trigger' => 'schedule.daily',
            'tag' => 'urgent',
            'action' => 'notify-admin',
        ], $admin)->assertCreated()->assertJsonPath('template.tag', 'urgent');

        $id = $created->json('template.id');

        $this->patchJson('/api/v1/automation/rule-templates/'.$id, [
            'name' => 'Renamed preset',
        ], $admin)->assertOk()->assertJsonPath('template.name', 'Renamed preset');

        $this->deleteJson('/api/v1/automation/rule-templates/'.$id, [], $admin)
            ->assertOk()->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/automation/rule-templates', $admin)->assertOk()->assertJsonCount(3, 'templates');
    }

    public function test_rejects_unknown_trigger_or_action_and_missing_template(): void
    {
        $admin = $this->adminHeaders();

        $this->postJson('/api/v1/automation/rule-templates', [
            'category' => 'archive',
            'name' => 'Bad',
            'trigger' => 'not-a-trigger',
            'action' => 'add-tag',
        ], $admin)->assertUnprocessable();

        $this->patchJson('/api/v1/automation/rule-templates/missing-id', ['name' => 'x'], $admin)
            ->assertNotFound();
    }

    private function adminHeaders(): array
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'rule-template-admin@example.test'],
            ['name' => 'Admin', 'password' => Hash::make('secret-password'), 'role' => 'admin'],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
