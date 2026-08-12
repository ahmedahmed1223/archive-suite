<?php

declare(strict_types=1);

use App\Mcp\Servers\ArchiveMcpServer;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;

/*
 * MCP-801: one capability definition (ArchiveMcpServer), registered on both
 * transports. The web transport rides the existing api/v1 origin — no new
 * internal port. archive.auth is a baseline gate only; MCP-802 adds OAuth
 * 2.1 + MCP scopes on top before this is considered safe for external
 * clients. The local transport runs `php artisan mcp:start archive-mcp`
 * inside the same container/host as the API, never a separate listener.
 */
Route::prefix('api/v1')->middleware(['api', 'archive.auth'])->group(function (): void {
    Mcp::web('/mcp', ArchiveMcpServer::class);
});

Mcp::local('archive-mcp', ArchiveMcpServer::class);
