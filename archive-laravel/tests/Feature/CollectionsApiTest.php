<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class CollectionsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_and_deletes_collections(): void
    {
        $created = $this->postJson('/api/v1/collections', [
            'name' => 'Needs review',
            'query' => 'draft',
            'type' => 'video',
            'tag' => 'unlabeled',
            'icon' => 'FolderKanban',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('collection.name', 'Needs review')
            ->assertJsonPath('collection.query', 'draft')
            ->assertJsonPath('collection.type', 'video')
            ->assertJsonPath('collection.tag', 'unlabeled')
            ->assertJsonPath('collection.icon', 'FolderKanban');

        $id = $created->json('collection.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/collections', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'collections')
            ->assertJsonPath('collections.0.id', $id);

        $this->deleteJson('/api/v1/collections/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/collections', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'collections');
    }

    public function test_it_defaults_type_and_tag_to_all(): void
    {
        $this->postJson('/api/v1/collections', [
            'name' => 'Everything',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('collection.type', 'all')
            ->assertJsonPath('collection.tag', 'all')
            ->assertJsonPath('collection.icon', null);
    }

    public function test_it_scopes_collections_to_the_owning_user(): void
    {
        $this->postJson('/api/v1/collections', [
            'name' => 'Mine',
        ], $this->authHeaders())->assertCreated();

        \App\Models\User::query()->firstOrCreate(
            ['email' => 'other@example.test'],
            ['name' => 'Other User', 'password' => \Illuminate\Support\Facades\Hash::make('secret-password')]
        );
        $otherLogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'other@example.test',
            'password' => 'secret-password',
        ])->assertOk();
        $otherToken = $otherLogin->json('accessToken');

        $this->getJson('/api/v1/collections', ['Authorization' => 'Bearer '.$otherToken])
            ->assertOk()
            ->assertJsonCount(0, 'collections');
    }

    public function test_it_rejects_invalid_collection_payload(): void
    {
        $this->postJson('/api/v1/collections', [
            'name' => '',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_deleting_missing_collection(): void
    {
        $this->deleteJson('/api/v1/collections/missing', [], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/collections')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }
}
