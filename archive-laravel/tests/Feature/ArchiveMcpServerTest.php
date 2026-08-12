<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * MCP-801: server bootstrap only — one capability definition registered on
 * both the web (api/v1/mcp) and local (stdio) transports. The web route is
 * gated by the existing archive.auth middleware as a baseline; MCP-802
 * replaces this with OAuth 2.1 + MCP scopes before any external client is
 * meant to reach it.
 */
class ArchiveMcpServerTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_the_web_transport_rejects_unauthenticated_requests(): void
    {
        $this->postJson('/api/v1/mcp', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'initialize',
        ])->assertUnauthorized();
    }

    public function test_the_web_transport_accepts_authenticated_requests(): void
    {
        $headers = $this->authHeaders();
        $headers['Accept'] = 'application/json, text/event-stream';

        $this->postJson('/api/v1/mcp', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'initialize',
            'params' => [
                'protocolVersion' => '2025-11-25',
                'capabilities' => [],
                'clientInfo' => ['name' => 'test-client', 'version' => '1.0.0'],
            ],
        ], $headers)->assertOk();
    }
}
