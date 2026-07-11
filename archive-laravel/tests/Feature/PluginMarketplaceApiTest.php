<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PluginMarketplaceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_reviewed_catalog_with_runtime_policy(): void
    {
        $response = $this->getJson('/api/v1/plugins', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('runtimePolicy.mode', 'catalog-only')
            ->assertJsonPath('runtimePolicy.allowsCodeExecution', false)
            ->assertJsonPath('runtimePolicy.allowsRemoteInstall', false);

        $this->assertGreaterThanOrEqual(2, count($response->json('plugins')));
        $this->assertContains('records:read', collect($response->json('permissionScopes'))->pluck('scope')->all());
    }

    public function test_it_filters_by_status_and_category(): void
    {
        $this->getJson('/api/v1/plugins?status=blocked&category=ai', $this->adminHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'plugins')
            ->assertJsonPath('plugins.0.id', 'external-ai-enrichment')
            ->assertJsonPath('plugins.0.securityReview.dataLeavesTenant', true);
    }

    public function test_it_rejects_invalid_filters_and_requires_authentication(): void
    {
        $this->getJson('/api/v1/plugins')
            ->assertUnauthorized();

        $this->getJson('/api/v1/plugins?status=installed', $this->adminHeaders())
            ->assertUnprocessable();
    }

    public function test_it_is_admin_only(): void
    {
        User::query()->create([
            'name' => 'Archive Viewer',
            'email' => 'plugin-viewer@example.test',
            'role' => 'viewer',
            'password' => Hash::make('secret-password'),
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'plugin-viewer@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/plugins', ['Authorization' => 'Bearer '.$token])
            ->assertForbidden();
    }

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        User::query()->firstOrCreate(
            ['email' => 'plugin-admin@example.test'],
            [
                'name' => 'Plugin Admin',
                'role' => 'admin',
                'password' => Hash::make('secret-password'),
            ],
        );

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'plugin-admin@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
