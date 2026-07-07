<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class InboxItemsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_updates_and_deletes_inbox_items(): void
    {
        $created = $this->postJson('/api/v1/inbox', [
            'title' => 'Loose footage',
            'source' => 'field drive',
            'note' => 'needs triage',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('item.title', 'Loose footage')
            ->assertJsonPath('item.status', 'new');

        $id = $created->json('item.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/inbox', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.id', $id);

        $this->patchJson('/api/v1/inbox/'.$id, ['status' => 'ready'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('item.status', 'ready');

        $this->deleteJson('/api/v1/inbox/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/inbox', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'items');
    }

    public function test_it_rejects_invalid_status(): void
    {
        $this->postJson('/api/v1/inbox', [
            'title' => 'Bad',
            'status' => 'nope',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_invalid_inbox_payload(): void
    {
        $this->postJson('/api/v1/inbox', ['title' => ''], $this->authHeaders())
            ->assertUnprocessable();
    }

    public function test_it_scopes_inbox_items_to_the_owning_user(): void
    {
        $this->postJson('/api/v1/inbox', ['title' => 'Mine'], $this->authHeaders())->assertCreated();

        \App\Models\User::query()->firstOrCreate(
            ['email' => 'other@example.test'],
            ['name' => 'Other User', 'password' => \Illuminate\Support\Facades\Hash::make('secret-password')]
        );
        $otherToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'other@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/inbox', ['Authorization' => 'Bearer '.$otherToken])
            ->assertOk()
            ->assertJsonCount(0, 'items');
    }

    public function test_it_rejects_updating_missing_inbox_item(): void
    {
        $this->patchJson('/api/v1/inbox/missing', ['status' => 'done'], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/inbox')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }
}
