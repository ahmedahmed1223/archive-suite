<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class SavedSearchesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_and_deletes_saved_searches(): void
    {
        $created = $this->postJson('/api/v1/saved-searches', [
            'name' => 'Unlabeled videos',
            'query' => 'video',
            'filters' => ['store' => 'archive-items', 'type' => 'video'],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('search.name', 'Unlabeled videos')
            ->assertJsonPath('search.query', 'video')
            ->assertJsonPath('search.filters.type', 'video');

        $id = $created->json('search.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/saved-searches', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'searches')
            ->assertJsonPath('searches.0.id', $id);

        $this->deleteJson('/api/v1/saved-searches/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/saved-searches', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'searches');
    }

    public function test_it_scopes_saved_searches_to_the_owning_user(): void
    {
        $this->postJson('/api/v1/saved-searches', [
            'name' => 'Mine',
            'query' => 'test',
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

        $this->getJson('/api/v1/saved-searches', ['Authorization' => 'Bearer '.$otherToken])
            ->assertOk()
            ->assertJsonCount(0, 'searches');
    }

    public function test_owner_can_share_a_search_read_only_with_another_user(): void
    {
        $created = $this->postJson('/api/v1/saved-searches', ['name' => 'فريق', 'query' => 'video'], $this->authHeaders())->assertCreated();
        $id = $created->json('search.id');
        $this->patchJson('/api/v1/saved-searches/'.$id, ['shared' => true], $this->authHeaders())->assertOk()->assertJsonPath('search.shared', true);

        \App\Models\User::query()->firstOrCreate(['email' => 'reader@example.test'], ['name' => 'Reader', 'password' => \Illuminate\Support\Facades\Hash::make('secret-password')]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'reader@example.test', 'password' => 'secret-password'])->json('accessToken');
        $this->getJson('/api/v1/saved-searches', ['Authorization' => 'Bearer '.$token])->assertOk()->assertJsonCount(1, 'searches')->assertJsonPath('searches.0.shared', true)->assertJsonPath('searches.0.canManage', false);
        $this->patchJson('/api/v1/saved-searches/'.$id, ['shared' => false], ['Authorization' => 'Bearer '.$token])->assertNotFound();
        $this->deleteJson('/api/v1/saved-searches/'.$id, [], ['Authorization' => 'Bearer '.$token])->assertNotFound();

        $copy = $this->postJson('/api/v1/saved-searches/'.$id.'/copy', [], ['Authorization' => 'Bearer '.$token])
            ->assertCreated()
            ->assertJsonPath('search.ownerId', (string) \App\Models\User::query()->where('email', 'reader@example.test')->firstOrFail()->getKey())
            ->assertJsonPath('search.shared', false)
            ->assertJsonPath('search.canManage', true);
        $this->assertNotSame($id, $copy->json('search.id'));
    }

    public function test_it_rejects_invalid_saved_search_payload(): void
    {
        $this->postJson('/api/v1/saved-searches', [
            'name' => '',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_deleting_missing_saved_search(): void
    {
        $this->deleteJson('/api/v1/saved-searches/missing', [], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/saved-searches')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }
}
