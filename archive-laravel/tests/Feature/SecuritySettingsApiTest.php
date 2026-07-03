<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecuritySettingsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        User::query()->create([
            'name' => 'Admin User',
            'email' => 'admin@example.test',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        User::query()->create([
            'name' => 'Viewer User',
            'email' => 'viewer@example.test',
            'password' => Hash::make('password'),
            'role' => 'viewer',
        ]);
    }

    public function test_get_security_settings_requires_auth(): void
    {
        $this->getJson('/api/v1/system/security-settings')
            ->assertUnauthorized();
    }

    public function test_get_security_settings_requires_admin_role(): void
    {
        $token = $this->loginAs('viewer@example.test', 'password');

        $this->getJson('/api/v1/system/security-settings', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_patch_security_settings_requires_admin_role(): void
    {
        $token = $this->loginAs('viewer@example.test', 'password');

        $this->patchJson('/api/v1/system/security-settings', [
            'accessTokenTtlMinutes' => 30,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_get_security_settings_returns_current_values(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $response = $this->getJson('/api/v1/system/security-settings', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonStructure([
                'settings' => [
                    'accessTokenTtlMinutes',
                    'perUserRateLimit',
                    'webhookUrlAllowlist',
                    'legacyPasswordUpgrade',
                    'cspPolicy',
                    'corsOrigins',
                ],
            ]);

        $this->assertIsArray($response->json('settings.webhookUrlAllowlist'));
    }

    public function test_patch_security_settings_requires_auth(): void
    {
        $this->patchJson('/api/v1/system/security-settings', [
            'accessTokenTtlMinutes' => 30,
        ])
            ->assertUnauthorized();
    }

    public function test_patch_security_settings_updates_access_token_ttl(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $response = $this->patchJson('/api/v1/system/security-settings', [
            'accessTokenTtlMinutes' => 45,
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('settings.accessTokenTtlMinutes', 45);
    }

    public function test_patch_security_settings_updates_per_user_rate_limit(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $response = $this->patchJson('/api/v1/system/security-settings', [
            'perUserRateLimit' => 120,
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonPath('settings.perUserRateLimit', 120);
    }

    public function test_patch_security_settings_updates_webhook_url_allowlist(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $urls = ['https://webhook.example.com', 'https://api.example.org'];

        $response = $this->patchJson('/api/v1/system/security-settings', [
            'webhookUrlAllowlist' => $urls,
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonPath('settings.webhookUrlAllowlist', $urls);
    }

    public function test_patch_security_settings_updates_legacy_password_upgrade(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $response = $this->patchJson('/api/v1/system/security-settings', [
            'legacyPasswordUpgrade' => true,
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonPath('settings.legacyPasswordUpgrade', true);
    }

    public function test_patch_security_settings_rejects_invalid_access_token_ttl(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $this->patchJson('/api/v1/system/security-settings', [
            'accessTokenTtlMinutes' => 0,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertUnprocessable();
    }

    public function test_patch_security_settings_rejects_invalid_per_user_rate_limit(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $this->patchJson('/api/v1/system/security-settings', [
            'perUserRateLimit' => -10,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertUnprocessable();
    }

    public function test_patch_security_settings_rejects_http_webhook_url(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $this->patchJson('/api/v1/system/security-settings', [
            'webhookUrlAllowlist' => ['http://webhook.example.com'],
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertUnprocessable();
    }

    public function test_patch_security_settings_rejects_invalid_webhook_url(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $this->patchJson('/api/v1/system/security-settings', [
            'webhookUrlAllowlist' => ['not-a-url'],
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertUnprocessable();
    }

    public function test_patch_security_settings_ignores_csp_policy_field(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $this->patchJson('/api/v1/system/security-settings', [
            'cspPolicy' => 'malicious-policy',
            'accessTokenTtlMinutes' => 30,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk();

        // CSP should not have changed
        $response = $this->getJson('/api/v1/system/security-settings', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $this->assertStringNotContainsString('malicious-policy', $response->json('settings.cspPolicy'));
    }

    public function test_patch_security_settings_ignores_cors_origins_field(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $this->patchJson('/api/v1/system/security-settings', [
            'corsOrigins' => ['https://malicious.com'],
            'accessTokenTtlMinutes' => 30,
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk();

        // CORS should not have changed
        $response = $this->getJson('/api/v1/system/security-settings', [
            'Authorization' => 'Bearer '.$token,
        ]);

        $this->assertNotContains('https://malicious.com', $response->json('settings.corsOrigins'));
    }

    public function test_patch_security_settings_accepts_empty_webhook_allowlist(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        // First set some URLs
        $this->patchJson('/api/v1/system/security-settings', [
            'webhookUrlAllowlist' => ['https://webhook.example.com'],
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        // Then clear them
        $response = $this->patchJson('/api/v1/system/security-settings', [
            'webhookUrlAllowlist' => [],
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonPath('settings.webhookUrlAllowlist', []);
    }

    public function test_patch_security_settings_with_multiple_fields(): void
    {
        $token = $this->loginAs('admin@example.test', 'password');

        $response = $this->patchJson('/api/v1/system/security-settings', [
            'accessTokenTtlMinutes' => 45,
            'perUserRateLimit' => 120,
            'legacyPasswordUpgrade' => true,
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonPath('settings.accessTokenTtlMinutes', 45)
            ->assertJsonPath('settings.perUserRateLimit', 120)
            ->assertJsonPath('settings.legacyPasswordUpgrade', true);
    }

    private function loginAs(string $email, string $password): string
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
        ]);

        return $response->json('accessToken');
    }
}
