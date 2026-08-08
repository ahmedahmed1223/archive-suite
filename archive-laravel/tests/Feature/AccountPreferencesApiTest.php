<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountPreferencesApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_own_locale(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/account/preferences', ['locale' => 'en'])
            ->assertOk()
            ->assertJsonPath('user.locale', 'en');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'locale' => 'en',
        ]);

        $this->actingAs($user->refresh())
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.locale', 'en');
    }

    public function test_locale_rejects_unknown_values(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/account/preferences', ['locale' => 'fr'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['locale']);
    }

    public function test_locale_update_requires_authentication(): void
    {
        $this->patchJson('/api/v1/account/preferences', ['locale' => 'en'])
            ->assertUnauthorized();
    }

    public function test_locale_update_uses_a_dedicated_redacted_audit_event(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/v1/account/preferences', ['locale' => 'ar'])
            ->assertOk();

        $log = AuditLog::query()->latest('id')->firstOrFail();

        $this->assertSame('account.preferences.update', $log->event);
        $this->assertSame('user_preferences', $log->resource_type);
        $this->assertSame((string) $user->id, (string) $log->resource_id);
        $this->assertArrayNotHasKey('request', $log->metadata);
        $this->assertArrayNotHasKey('diff', $log->metadata);
    }
}
