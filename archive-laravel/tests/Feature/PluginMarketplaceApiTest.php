<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class PluginMarketplaceApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_returns_reviewed_catalog_with_runtime_policy(): void
    {
        $response = $this->getJson('/api/v1/plugins', $this->authHeaders())
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
        $this->getJson('/api/v1/plugins?status=blocked&category=ai', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'plugins')
            ->assertJsonPath('plugins.0.id', 'external-ai-enrichment')
            ->assertJsonPath('plugins.0.securityReview.dataLeavesTenant', true);
    }

    public function test_it_rejects_invalid_filters_and_requires_authentication(): void
    {
        $this->getJson('/api/v1/plugins')
            ->assertUnauthorized();

        $this->getJson('/api/v1/plugins?status=installed', $this->authHeaders())
            ->assertUnprocessable();
    }
}
