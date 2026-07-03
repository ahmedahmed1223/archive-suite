<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserInvitation;
use App\Support\ApiToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class UsersApiTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(User $user): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return $login->json('accessToken');
    }

    private function adminHeaders(): array
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Viewer',
            'email' => 'viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($viewer)];
    }

    public function test_admin_can_list_users_and_pending_invitations(): void
    {
        $headers = $this->adminHeaders();

        UserInvitation::query()->create([
            'id' => (string) Str::uuid(),
            'email' => 'pending@example.test',
            'role' => 'editor',
            'token_hash' => ApiToken::hash('some-token'),
            'invited_by' => User::query()->where('email', 'admin@example.test')->value('id'),
            'expires_at' => now()->addDays(7),
        ]);

        $this->getJson('/api/v1/users', $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'users')
            ->assertJsonCount(1, 'invitations')
            ->assertJsonPath('invitations.0.email', 'pending@example.test');
    }

    public function test_non_admin_cannot_list_users(): void
    {
        $this->getJson('/api/v1/users', $this->viewerHeaders())
            ->assertForbidden();
    }

    public function test_admin_can_invite_a_new_user(): void
    {
        $response = $this->postJson('/api/v1/users', [
            'email' => 'new-editor@example.test',
            'role' => 'editor',
        ], $this->adminHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('invitation.email', 'new-editor@example.test');

        $this->assertDatabaseHas('user_invitations', [
            'email' => 'new-editor@example.test',
            'role' => 'editor',
        ]);
        $this->assertIsString($response->json('token'));
    }

    public function test_invite_rejects_an_existing_email(): void
    {
        $this->postJson('/api/v1/users', [
            'email' => 'admin@example.test',
            'role' => 'editor',
        ], $this->adminHeaders())
            ->assertUnprocessable();
    }

    public function test_admin_can_update_a_users_role(): void
    {
        $headers = $this->adminHeaders();
        $target = User::query()->create([
            'name' => 'Editor',
            'email' => 'editor@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $this->patchJson("/api/v1/users/{$target->id}", ['role' => 'editor'], $headers)
            ->assertOk()
            ->assertJsonPath('user.role', 'editor');

        $this->assertDatabaseHas('users', ['id' => $target->id, 'role' => 'editor']);
    }

    public function test_admin_can_delete_another_user_but_not_self(): void
    {
        $headers = $this->adminHeaders();
        $adminId = User::query()->where('email', 'admin@example.test')->value('id');
        $target = User::query()->create([
            'name' => 'Editor',
            'email' => 'editor@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $this->deleteJson("/api/v1/users/{$target->id}", [], $headers)->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $target->id]);

        $this->deleteJson("/api/v1/users/{$adminId}", [], $headers)->assertUnprocessable();
    }

    public function test_invitation_can_be_accepted_to_create_a_new_user(): void
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        $token = ApiToken::create();
        UserInvitation::query()->create([
            'id' => (string) Str::uuid(),
            'email' => 'invitee@example.test',
            'role' => 'editor',
            'token_hash' => ApiToken::hash($token),
            'invited_by' => $admin->id,
            'expires_at' => now()->addDays(7),
        ]);

        $this->postJson("/api/v1/invitations/{$token}/accept", [
            'name' => 'Invitee',
            'password' => 'a-strong-password',
        ])
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('user.email', 'invitee@example.test')
            ->assertJsonPath('user.role', 'editor');

        $this->assertDatabaseHas('users', ['email' => 'invitee@example.test', 'role' => 'editor']);
        $this->assertDatabaseHas('user_invitations', ['email' => 'invitee@example.test']);
    }

    public function test_accepting_an_expired_invitation_fails(): void
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        $token = ApiToken::create();
        UserInvitation::query()->create([
            'id' => (string) Str::uuid(),
            'email' => 'expired@example.test',
            'role' => 'viewer',
            'token_hash' => ApiToken::hash($token),
            'invited_by' => $admin->id,
            'expires_at' => now()->subDay(),
        ]);

        $this->postJson("/api/v1/invitations/{$token}/accept", [
            'name' => 'Invitee',
            'password' => 'a-strong-password',
        ])->assertNotFound();
    }
}
