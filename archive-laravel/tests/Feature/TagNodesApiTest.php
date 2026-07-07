<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class TagNodesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_updates_and_deletes_tag_nodes(): void
    {
        $created = $this->postJson('/api/v1/tag-nodes', [
            'tag' => 'مقابلات',
            'parent' => 'محتوى',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('node.tag', 'مقابلات')
            ->assertJsonPath('node.parent', 'محتوى');

        $id = $created->json('node.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/tag-nodes', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'nodes')
            ->assertJsonPath('nodes.0.id', $id);

        $this->patchJson('/api/v1/tag-nodes/'.$id, ['parent' => 'أرشيف'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('node.parent', 'أرشيف');

        $this->deleteJson('/api/v1/tag-nodes/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/tag-nodes', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'nodes');
    }

    public function test_it_scopes_tag_nodes_to_the_owning_user(): void
    {
        $this->postJson('/api/v1/tag-nodes', ['tag' => 'Mine', 'parent' => 'Root'], $this->authHeaders())
            ->assertCreated();

        \App\Models\User::query()->firstOrCreate(
            ['email' => 'other@example.test'],
            ['name' => 'Other User', 'password' => \Illuminate\Support\Facades\Hash::make('secret-password')]
        );
        $otherToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'other@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/tag-nodes', ['Authorization' => 'Bearer '.$otherToken])
            ->assertOk()
            ->assertJsonCount(0, 'nodes');
    }

    public function test_it_rejects_invalid_tag_node_payload(): void
    {
        $this->postJson('/api/v1/tag-nodes', ['tag' => 'Orphan'], $this->authHeaders())
            ->assertUnprocessable();
    }

    public function test_it_rejects_updating_missing_tag_node(): void
    {
        $this->patchJson('/api/v1/tag-nodes/missing', ['parent' => 'Root'], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_deleting_missing_tag_node(): void
    {
        $this->deleteJson('/api/v1/tag-nodes/missing', [], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/tag-nodes')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }
}
