<?php

declare(strict_types=1);

namespace App\Mcp\Tools\Concerns;

use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Mcp\Request as McpRequest;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * MCP-803: every read tool calls the same application services the HTTP API
 * uses (SearchController, RecordsController, ...) instead of re-implementing
 * search/read logic — including their existing role gates, which read
 * `archive_user` off the request the same way archive.auth always has.
 */
trait DelegatesToHttpController
{
    private function authorizeTool(McpRequest $request, string $tool, bool $requestsHumanReview = false): Response|ResponseFactory|null
    {
        $user = $request->user();
        if ($user === null) {
            return Response::error('Authentication is required.');
        }

        if ($requestsHumanReview && ! in_array((string) $user->role, config('mcp.review_request_roles'), true)) {
            return Response::error('This user may not create review requests.');
        }

        $key = 'mcp:tool:'.$tool.':user:'.$user->getKey();
        $maxAttempts = max(1, (int) config('mcp.tool_requests_per_minute'));
        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            return Response::error('Tool request limit reached. Try again shortly.');
        }

        RateLimiter::hit($key, 60);

        return null;
    }

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
