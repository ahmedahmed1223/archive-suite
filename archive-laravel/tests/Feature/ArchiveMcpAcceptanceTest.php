<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * MCP-805: operational acceptance for the parts of the MCP protocol that sit
 * outside any single tool/resource — OAuth discovery (RFC 8414/9728) and
 * dynamic client registration (RFC 7591). Runs as part of the normal
 * `verify:laravel` suite, which `release:verify` already depends on, so this
 * is the "MCP check wired into release:verify" gate MCP-805 asks for.
 */
class ArchiveMcpAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorization_server_metadata_is_discoverable(): void
    {
        $this->getJson('/.well-known/oauth-authorization-server')
            ->assertOk()
            ->assertJson(fn ($json) => $json
                ->where('authorization_endpoint', route('passport.authorizations.authorize'))
                ->where('token_endpoint', route('passport.token'))
                ->where('scopes_supported', ['mcp:use'])
                ->where('code_challenge_methods_supported', ['S256'])
                ->etc());
    }

    public function test_protected_resource_metadata_is_discoverable(): void
    {
        $this->getJson('/.well-known/oauth-protected-resource')
            ->assertOk()
            ->assertJson(fn ($json) => $json
                ->where('scopes_supported', ['mcp:use'])
                ->has('authorization_servers')
                ->etc());
    }

    public function test_a_third_party_client_can_dynamically_register(): void
    {
        // Registered clients are public (PKCE, no client_secret) per RFC 7591 +
        // the MCP spec's public-client convention — confirmed against the
        // package's OAuthRegisterController, which calls
        // createAuthorizationCodeGrantClient(confidential: false).
        $this->postJson('/oauth/register', [
            'client_name' => 'Acceptance Test Client',
            'redirect_uris' => ['https://example.com/callback'],
        ])
            ->assertCreated()
            ->assertJson(fn ($json) => $json
                ->where('scope', 'mcp:use')
                ->where('token_endpoint_auth_method', 'none')
                ->where('redirect_uris', ['https://example.com/callback'])
                ->etc());

        $this->assertDatabaseHas('oauth_clients', ['name' => 'Acceptance Test Client']);
    }

    public function test_registration_rejects_a_missing_redirect_uri(): void
    {
        $this->postJson('/oauth/register', ['client_name' => 'No Redirect'])
            ->assertStatus(400)
            ->assertJson(['error' => 'invalid_redirect_uri']);
    }
}
