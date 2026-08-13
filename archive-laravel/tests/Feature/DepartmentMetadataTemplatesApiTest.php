<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class DepartmentMetadataTemplatesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_department_template_keeps_an_immutable_version_history_and_can_be_disabled(): void
    {
        $created = $this->postJson('/api/v1/metadata-templates', [
            'name' => 'أخبار القسم', 'departmentId' => 'news', 'fields' => ['summary' => 'عاجل'],
            'tags' => ['خبر'], 'usageRoles' => ['editor'],
        ], $this->authHeaders())->assertCreated()
            ->assertJsonPath('template.departmentId', 'news')
            ->assertJsonPath('template.currentVersion', 1)
            ->assertJsonPath('template.usageRoles.0', 'editor');

        $id = $created->json('template.id');
        $this->patchJson("/api/v1/metadata-templates/{$id}", [
            'fields' => ['summary' => 'محدّث'], 'enabled' => false,
        ], $this->authHeaders())->assertOk()
            ->assertJsonPath('template.enabled', false)
            ->assertJsonPath('template.currentVersion', 2);

        $this->getJson("/api/v1/metadata-templates/{$id}/versions", $this->authHeaders())->assertOk()
            ->assertJsonCount(2, 'versions')
            ->assertJsonPath('versions.0.version', 2)
            ->assertJsonPath('versions.0.snapshot.fields.summary', 'محدّث')
            ->assertJsonPath('versions.1.snapshot.fields.summary', 'عاجل');

        $this->getJson('/api/v1/metadata-templates?departmentId=news', $this->authHeaders())
            ->assertOk()->assertJsonCount(0, 'templates');
        $this->getJson('/api/v1/metadata-templates?departmentId=news&includeDisabled=1', $this->authHeaders())
            ->assertOk()->assertJsonCount(1, 'templates');
    }

    public function test_template_usage_roles_limit_the_templates_offered_to_a_role(): void
    {
        $this->postJson('/api/v1/metadata-templates', [
            'name' => 'للمحررين فقط', 'departmentId' => 'news', 'usageRoles' => ['editor'],
        ], $this->authHeaders())->assertCreated();

        User::query()->create(['name' => 'Viewer', 'email' => 'template-viewer@example.test', 'password' => Hash::make('secret-password'), 'role' => 'viewer']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'template-viewer@example.test', 'password' => 'secret-password'])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/metadata-templates?departmentId=news', ['Authorization' => 'Bearer '.$token])
            ->assertOk()->assertJsonCount(0, 'templates');
    }
}
