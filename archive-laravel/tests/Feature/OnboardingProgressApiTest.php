<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OnboardingProgressApiTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, string> */
    private function headersFor(string $role, string $email): array
    {
        $user = User::query()->create([
            'name' => ucfirst($role),
            'email' => $email,
            'password' => Hash::make('secret-password'),
            'role' => $role,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }

    public function test_authenticated_users_see_the_shared_default_progress(): void
    {
        $this->getJson('/api/v1/onboarding/progress', $this->headersFor('viewer', 'viewer@example.test'))
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('progress.stages.0.id', 'organization')
            ->assertJsonPath('progress.stages.0.status', 'pending')
            ->assertJsonPath('progress.stages.0.completedAt', null)
            ->assertJsonPath('progress.stages.4.id', 'first_search')
            ->assertJsonCount(5, 'progress.stages');
    }

    public function test_admin_can_complete_a_stage_and_the_shared_progress_persists(): void
    {
        $adminHeaders = $this->headersFor('admin', 'admin@example.test');

        $this->patchJson('/api/v1/onboarding/progress/organization', ['status' => 'completed'], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('progress.stages.0.status', 'completed')
            ->assertJsonPath('progress.stages.0.id', 'organization')
            ->assertJsonPath('progress.stages.0.completedAt', fn ($value) => is_string($value) && $value !== '');

        $this->getJson('/api/v1/onboarding/progress', $this->headersFor('editor', 'editor@example.test'))
            ->assertOk()
            ->assertJsonPath('progress.stages.0.status', 'completed')
            ->assertJsonPath('progress.stages.0.completedAt', fn ($value) => is_string($value) && $value !== '');
    }

    public function test_only_admins_can_change_progress_and_invalid_updates_are_rejected(): void
    {
        $viewerHeaders = $this->headersFor('viewer', 'viewer@example.test');

        $this->patchJson('/api/v1/onboarding/progress/organization', ['status' => 'completed'], $viewerHeaders)
            ->assertForbidden();

        $adminHeaders = $this->headersFor('admin', 'admin@example.test');

        $this->patchJson('/api/v1/onboarding/progress/unknown', ['status' => 'completed'], $adminHeaders)
            ->assertUnprocessable();
        $this->patchJson('/api/v1/onboarding/progress/organization', ['status' => 'working'], $adminHeaders)
            ->assertUnprocessable();
        $this->getJson('/api/v1/onboarding/progress')->assertUnauthorized();
    }
}
