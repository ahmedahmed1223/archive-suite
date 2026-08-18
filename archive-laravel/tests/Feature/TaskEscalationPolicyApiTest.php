<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class TaskEscalationPolicyApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_reads_the_default_policy(): void
    {
        $this->getJson('/api/v1/task-escalation-policy', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('policy.enabled', true)
            ->assertJsonPath('policy.warningBeforeMinutes', 60)
            ->assertJsonPath('policy.repeatMinutes', 240);
    }

    public function test_an_editor_cannot_update_the_policy(): void
    {
        $this->patchJson('/api/v1/task-escalation-policy', ['enabled' => false], $this->authHeaders())
            ->assertForbidden();
    }

    public function test_an_admin_can_update_the_policy(): void
    {
        $admin = $this->adminHeaders();

        $this->patchJson('/api/v1/task-escalation-policy', [
            'warningBeforeMinutes' => 30,
            'repeatMinutes' => null,
        ], $admin)
            ->assertOk()
            ->assertJsonPath('policy.warningBeforeMinutes', 30)
            ->assertJsonPath('policy.repeatMinutes', null);

        $this->getJson('/api/v1/task-escalation-policy', $admin)
            ->assertOk()
            ->assertJsonPath('policy.warningBeforeMinutes', 30);
    }

    public function test_rejects_an_empty_update(): void
    {
        $this->patchJson('/api/v1/task-escalation-policy', [], $this->adminHeaders())
            ->assertUnprocessable();
    }

    private function adminHeaders(): array
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'escalation-policy-admin@example.test'],
            ['name' => 'Admin', 'password' => Hash::make('secret-password'), 'role' => 'admin'],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
