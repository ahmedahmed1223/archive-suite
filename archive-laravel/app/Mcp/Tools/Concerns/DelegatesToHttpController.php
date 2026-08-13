<?php

declare(strict_types=1);

namespace App\Mcp\Tools\Concerns;

use Illuminate\Http\Request as HttpRequest;
use Laravel\Mcp\Request as McpRequest;

/**
 * MCP-803: every read tool calls the same application services the HTTP API
 * uses (SearchController, RecordsController, ...) instead of re-implementing
 * search/read logic — including their existing role gates, which read
 * `archive_user` off the request the same way archive.auth always has.
 */
trait DelegatesToHttpController
{
    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $routeParameters
     * @return array<string, mixed>
     */
    private function delegate(
        McpRequest $mcpRequest,
        string $controller,
        string $method,
        array $query = [],
        array $routeParameters = [],
    ): array {
        $httpRequest = HttpRequest::create('/', 'GET', $query);
        $user = $mcpRequest->user();
        $httpRequest->setUserResolver(fn () => $user);
        $httpRequest->attributes->set('archive_user', $user);

        $response = app()->call([app($controller), $method], ['request' => $httpRequest, ...$routeParameters]);

        return json_decode($response->getContent(), true) ?? [];
    }
}
