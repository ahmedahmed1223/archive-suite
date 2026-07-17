<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * V1-759: admin-managed API keys, usable as a bearer credential alternative
 * to session tokens, capped at editor role.
 */
class ApiKeysTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');
    }

    private function adminHeaders(): array
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@example.test'],
            ['name' => 'Admin', 'password' => Hash::make('secret-password'), 'role' => 'admin'],
        );

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    private function editorHeaders(): array
    {
        $editor = User::query()->firstOrCreate(
            ['email' => 'editor@example.test'],
            ['name' => 'Editor', 'password' => Hash::make('secret-password'), 'role' => 'editor'],
        );

        return ['Authorization' => 'Bearer '.$this->tokenFor($editor)];
    }

    public function test_admin_can_create_an_api_key_and_the_raw_token_is_shown_once(): void
    {
        $response = $this->postJson('/api/v1/api-keys', [
            'name' => 'CI automation',
            'role' => 'editor',
        ], $this->adminHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('apiKey.name', 'CI automation')
            ->assertJsonPath('apiKey.role', 'editor');

        $token = $response->json('token');
        $this->assertIsString($token);
        $this->assertNotSame('', $token);

        // The response never contains the row's stored hash directly, and
        // the raw token itself must never be persisted anywhere.
        $this->assertDatabaseMissing('api_keys', ['token_hash' => $token]);
        $this->assertDatabaseHas('api_keys', ['name' => 'CI automation', 'role' => 'editor']);
    }

    public function test_creating_an_api_key_with_admin_role_is_rejected(): void
    {
        $this->postJson('/api/v1/api-keys', [
            'name' => 'Should fail',
            'role' => 'admin',
        ], $this->adminHeaders())->assertUnprocessable();

        $this->assertDatabaseMissing('api_keys', ['name' => 'Should fail']);
    }

    public function test_non_admin_cannot_manage_api_keys(): void
    {
        $headers = $this->editorHeaders();

        $this->getJson('/api/v1/api-keys', $headers)->assertForbidden();
        $this->postJson('/api/v1/api-keys', ['name' => 'x', 'role' => 'editor'], $headers)->assertForbidden();
    }

    public function test_admin_can_list_and_delete_api_keys(): void
    {
        $headers = $this->adminHeaders();

        $id = $this->postJson('/api/v1/api-keys', [
            'name' => 'Deletable',
            'role' => 'viewer',
        ], $headers)->assertCreated()->json('apiKey.id');

        $this->getJson('/api/v1/api-keys', $headers)
            ->assertOk()
            ->assertJsonCount(1, 'apiKeys');

        $this->deleteJson("/api/v1/api-keys/{$id}", [], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('api_keys', ['id' => $id]);
    }

    public function test_deleting_an_unknown_api_key_404s(): void
    {
        $this->deleteJson('/api/v1/api-keys/does-not-exist', [], $this->adminHeaders())
            ->assertNotFound();
    }

    public function test_api_key_authenticates_requests_as_a_bearer_token(): void
    {
        $token = $this->postJson('/api/v1/api-keys', [
            'name' => 'Records reader',
            'role' => 'editor',
        ], $this->adminHeaders())->assertCreated()->json('token');

        $this->getJson('/api/v1/records?store=archive-items', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_api_key_role_is_capped_at_editor_even_though_the_creating_admin_is_admin(): void
    {
        $token = $this->postJson('/api/v1/api-keys', [
            'name' => 'Capped key',
            'role' => 'editor',
        ], $this->adminHeaders())->assertCreated()->json('token');

        // The key's owner is the admin who created it, but the key itself
        // only carries editor — it must never reach admin-only endpoints.
        $this->getJson('/api/v1/users', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }

    public function test_unknown_bearer_token_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/records', ['Authorization' => 'Bearer not-a-real-token'])
            ->assertUnauthorized();
    }
}
