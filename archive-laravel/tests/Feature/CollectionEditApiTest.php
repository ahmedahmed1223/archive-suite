<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class CollectionEditApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_updates_the_name_and_criteria_of_an_existing_collection(): void
    {
        $id = $this->postJson('/api/v1/collections', ['name' => 'مجموعة أولى'], $this->authHeaders())
            ->assertCreated()->json('collection.id');

        $this->patchJson("/api/v1/collections/{$id}", ['name' => 'مجموعة محدّثة', 'tag' => 'أرشيف'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('collection.name', 'مجموعة محدّثة')
            ->assertJsonPath('collection.tag', 'أرشيف');
    }

    public function test_it_manages_explicit_record_membership(): void
    {
        $id = $this->postJson('/api/v1/collections', ['name' => 'مجموعة'], $this->authHeaders())
            ->assertCreated()->json('collection.id');

        $this->postJson("/api/v1/collections/{$id}/records/item-1", [], $this->authHeaders())->assertOk();
        $this->postJson("/api/v1/collections/{$id}/records/item-2", [], $this->authHeaders())->assertOk();

        $this->getJson("/api/v1/collections/{$id}/records", $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'recordIds');

        $this->deleteJson("/api/v1/collections/{$id}/records/item-1", [], $this->authHeaders())->assertOk();

        $this->getJson("/api/v1/collections/{$id}/records", $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'recordIds')
            ->assertJsonPath('recordIds.0', 'item-2');
    }

    public function test_a_viewer_cannot_update_another_users_collection(): void
    {
        $id = $this->postJson('/api/v1/collections', ['name' => 'مجموعة'], $this->authHeaders())
            ->assertCreated()->json('collection.id');

        $viewer = User::query()->create(['name' => 'v', 'email' => 'viewer2@example.com', 'password' => Hash::make('secret-password'), 'role' => 'viewer']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'viewer2@example.com', 'password' => 'secret-password'])->assertOk()->json('accessToken');

        $this->patchJson("/api/v1/collections/{$id}", ['name' => 'محاولة'], ['Authorization' => 'Bearer '.$token])
            ->assertStatus(403);
    }

    public function test_updating_with_no_fields_is_rejected(): void
    {
        $id = $this->postJson('/api/v1/collections', ['name' => 'مجموعة'], $this->authHeaders())
            ->assertCreated()->json('collection.id');

        $this->patchJson("/api/v1/collections/{$id}", [], $this->authHeaders())->assertStatus(422);
    }
}
