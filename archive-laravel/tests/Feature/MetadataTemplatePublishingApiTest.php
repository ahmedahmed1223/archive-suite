<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class MetadataTemplatePublishingApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_only_an_admin_can_publish_a_draft_and_users_receive_the_published_snapshot(): void
    {
        $id = $this->postJson('/api/v1/metadata-templates', ['name' => 'مسودة الأخبار', 'departmentId' => 'news', 'fields' => ['summary' => 'الأصل']], $this->authHeaders())->assertCreated()->json('template.id');
        $this->getJson('/api/v1/metadata-templates?departmentId=news', $this->authHeaders())->assertOk()->assertJsonCount(0, 'templates');
        $this->postJson("/api/v1/metadata-templates/{$id}/publish", [], $this->authHeaders())->assertForbidden();

        $admin = User::query()->create(['name' => 'Admin', 'email' => 'template-admin@example.test', 'password' => Hash::make('secret-password'), 'role' => 'admin']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'secret-password'])->assertOk()->json('accessToken');
        $headers = ['Authorization' => 'Bearer '.$token];
        $this->postJson("/api/v1/metadata-templates/{$id}/publish", [], $headers)->assertOk()->assertJsonPath('template.publishedVersion', 1);

        $this->patchJson("/api/v1/metadata-templates/{$id}", ['fields' => ['summary' => 'مسودة جديدة']], $this->authHeaders())->assertOk()->assertJsonPath('template.currentVersion', 2);
        $this->getJson('/api/v1/metadata-templates?departmentId=news', $this->authHeaders())->assertOk()->assertJsonPath('templates.0.fields.summary', 'الأصل')->assertJsonPath('templates.0.currentVersion', 1);
        $this->postJson("/api/v1/metadata-templates/{$id}/published-version/1/restore", [], $headers)->assertOk()->assertJsonPath('template.publishedVersion', 1);
    }
}
