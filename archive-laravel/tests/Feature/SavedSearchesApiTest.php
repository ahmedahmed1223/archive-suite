<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class SavedSearchesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

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

        User::query()->firstOrCreate(
            ['email' => 'other@example.test'],
            ['name' => 'Other User', 'password' => Hash::make('secret-password')]
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

    public function test_owner_can_share_a_search_explicitly_with_another_user(): void
    {
        $created = $this->postJson('/api/v1/saved-searches', ['name' => 'فريق', 'query' => 'video'], $this->authHeaders())->assertCreated();
        $id = $created->json('search.id');

        $reader = User::query()->firstOrCreate(['email' => 'reader@example.test'], ['name' => 'Reader', 'password' => Hash::make('secret-password')]);
        $this->putJson('/api/v1/saved-searches/'.$id.'/access', ['departmentId' => 'newsroom', 'members' => [['userId' => (string) $reader->getKey(), 'role' => 'viewer']]], $this->authHeaders())
            ->assertOk()->assertJsonPath('search.departmentId', 'newsroom')->assertJsonPath('search.members.0.role', 'viewer');
        $this->assertDatabaseHas('audit_logs', ['event' => 'saved_search_access.replace', 'resource_id' => $id]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'reader@example.test', 'password' => 'secret-password'])->json('accessToken');
        $this->getJson('/api/v1/saved-searches', ['Authorization' => 'Bearer '.$token])->assertOk()->assertJsonCount(1, 'searches')->assertJsonPath('searches.0.shared', true)->assertJsonPath('searches.0.accessRole', 'viewer')->assertJsonPath('searches.0.canManage', false);
        $this->putJson('/api/v1/saved-searches/'.$id.'/access', ['members' => []], ['Authorization' => 'Bearer '.$token])->assertNotFound();
        $this->deleteJson('/api/v1/saved-searches/'.$id, [], ['Authorization' => 'Bearer '.$token])->assertNotFound();

        $copy = $this->postJson('/api/v1/saved-searches/'.$id.'/copy', [], ['Authorization' => 'Bearer '.$token])
            ->assertCreated()
            ->assertJsonPath('search.ownerId', (string) User::query()->where('email', 'reader@example.test')->firstOrFail()->getKey())
            ->assertJsonPath('search.shared', false)
            ->assertJsonPath('search.canManage', true);
        $this->assertNotSame($id, $copy->json('search.id'));
    }

    public function test_editor_can_manage_members_without_revealing_a_personal_search(): void
    {
        $created = $this->postJson('/api/v1/saved-searches', ['name' => 'خاص', 'query' => 'video'], $this->authHeaders())->assertCreated();
        $id = $created->json('search.id');
        $editor = User::query()->create(['email' => 'editor@example.test', 'name' => 'Editor', 'password' => Hash::make('secret-password')]);
        $viewer = User::query()->create(['email' => 'viewer@example.test', 'name' => 'Viewer', 'password' => Hash::make('secret-password')]);
        $this->putJson('/api/v1/saved-searches/'.$id.'/access', ['members' => [['userId' => (string) $editor->getKey(), 'role' => 'editor']]], $this->authHeaders())->assertOk();
        $editorToken = $this->postJson('/api/v1/auth/login', ['email' => 'editor@example.test', 'password' => 'secret-password'])->json('accessToken');
        $this->putJson('/api/v1/saved-searches/'.$id.'/access', ['members' => [['userId' => (string) $editor->getKey(), 'role' => 'editor'], ['userId' => (string) $viewer->getKey(), 'role' => 'viewer']]], ['Authorization' => 'Bearer '.$editorToken])->assertOk()->assertJsonPath('search.members.1.role', 'viewer');
        $viewerToken = $this->postJson('/api/v1/auth/login', ['email' => 'viewer@example.test', 'password' => 'secret-password'])->json('accessToken');
        $this->getJson('/api/v1/saved-searches', ['Authorization' => 'Bearer '.$viewerToken])->assertOk()->assertJsonCount(1, 'searches');
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
