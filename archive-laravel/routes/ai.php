<?php

declare(strict_types=1);

use App\Mcp\Servers\ArchiveMcpServer;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;

/*
 * MCP-802: OAuth 2.1 (PKCE + RFC 7591 dynamic client registration + RFC
 * 8414/9728 discovery) via Laravel Passport — a translation layer onto the
 * existing App\Models\User, not a second identity system. Passport's own
 * oauth_* tables hold only the protocol-required bookkeeping (registered
 * clients, auth codes, tokens); the rest of the API is untouched and keeps
 * using archive.auth. Discovery/registration routes must stay unauthenticated
 * (a client has no token yet when it fetches them), so they're registered
 * outside the api/v1 group below.
 */
Mcp::ensureMcpScope();
Mcp::oauthRoutes();

/*
 * MCP-801: one capability definition (ArchiveMcpServer), registered on both
 * transports. The web transport rides the existing api/v1 origin — no new
 * internal port. The local transport runs `php artisan mcp:start
 * archive-mcp` inside the same container/host as the API, never a separate
 * listener — stdio has no HTTP surface to authenticate, it inherits
 * whatever OS-level trust runs the command.
 */
Route::prefix('api/v1')->middleware(['api'])->group(function (): void {
    Mcp::web('/mcp', ArchiveMcpServer::class)->middleware('auth:api');
});

Mcp::local('archive-mcp', ArchiveMcpServer::class);
