<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Passport\Passport;
use Tests\TestCase;

/**
 * MCP-801/802: server bootstrap plus the OAuth 2.1 gate. The web route is
 * guarded by Passport's `auth:api` (routes/ai.php) — a translation layer onto
 * the existing App\Models\User, not a second identity system. The rest of the
 * API keeps using archive.auth untouched.
 */
class ArchiveMcpServerTest extends TestCase
{
    use RefreshDatabase;

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
        Passport::actingAs(User::factory()->create(), ['mcp:use']);

        $this->postJson('/api/v1/mcp', [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'initialize',
            'params' => [
                'protocolVersion' => '2025-11-25',
                'capabilities' => [],
                'clientInfo' => ['name' => 'test-client', 'version' => '1.0.0'],
            ],
        ], ['Accept' => 'application/json, text/event-stream'])->assertOk();
    }
}
