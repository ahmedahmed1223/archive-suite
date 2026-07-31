<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class MetadataTemplatesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_updates_and_deletes_a_template(): void
    {
        $created = $this->postJson('/api/v1/metadata-templates', [
            'name' => 'قالب أخبار',
            'typeId' => 'news',
            'departmentId' => 'news',
            'fields' => ['description' => 'خبر عاجل'],
            'tags' => ['عاجل'],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('template.name', 'قالب أخبار')
            ->assertJsonPath('template.typeId', 'news')
            ->assertJsonPath('template.fields.description', 'خبر عاجل');

        $id = $created->json('template.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/metadata-templates?typeId=news', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('templates.0.id', $id);

        $this->getJson('/api/v1/metadata-templates?typeId=program', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'templates');

        $this->patchJson('/api/v1/metadata-templates/'.$id, ['name' => 'قالب محدّث'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('template.name', 'قالب محدّث');

        $this->deleteJson('/api/v1/metadata-templates/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/metadata-templates', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'templates');
    }

    public function test_it_rejects_an_empty_name(): void
    {
        $this->postJson('/api/v1/metadata-templates', ['name' => ''], $this->authHeaders())->assertStatus(422);
    }

    public function test_updating_an_unknown_template_returns_not_found(): void
    {
        $this->patchJson('/api/v1/metadata-templates/unknown', ['name' => 'جديد'], $this->authHeaders())
            ->assertStatus(404);
    }
}
