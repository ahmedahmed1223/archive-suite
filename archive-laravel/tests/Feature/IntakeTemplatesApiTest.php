<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class IntakeTemplatesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_and_deletes_intake_templates(): void
    {
        $created = $this->postJson('/api/v1/intake-templates', [
            'name' => 'Video quick add',
            'type' => 'video',
            'fields' => ['rights' => 'internal', 'tags' => ['news']],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('template.name', 'Video quick add')
            ->assertJsonPath('template.type', 'video')
            ->assertJsonPath('template.fields.rights', 'internal');

        $id = $created->json('template.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/intake-templates', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'templates')
            ->assertJsonPath('templates.0.id', $id);

        $this->deleteJson('/api/v1/intake-templates/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/intake-templates', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'templates');
    }

    public function test_it_rejects_invalid_template_payloads(): void
    {
        $this->postJson('/api/v1/intake-templates', [
            'name' => '',
            'fields' => [],
        ], $this->authHeaders())->assertUnprocessable();

        $this->postJson('/api/v1/intake-templates', [
            'name' => 'Missing fields',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_deleting_missing_template(): void
    {
        $this->deleteJson('/api/v1/intake-templates/missing', [], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/intake-templates')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }
}
