<?php

declare(strict_types=1);

namespace App\Ai\Tools\Concerns;

use App\Models\User;
use Illuminate\Http\Request as HttpRequest;

/**
 * AI-802: every read tool calls the same application services the HTTP API
 * uses (SearchController, RecordsController, ...) instead of re-implementing
 * search/read logic - same idiom as App\Mcp\Tools\Concerns\DelegatesToHttpController
 * (MCP-803), adapted for the AI SDK's Tool contract, which has no per-request
 * user resolver of its own, so the user is injected at construction time.
 */
trait DelegatesToHttpController
{
    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $routeParameters
     * @return array<string, mixed>
     */
    private function delegate(
        User $user,
        string $controller,
        string $method,
        array $query = [],
        array $routeParameters = [],
    ): array {
        $httpRequest = HttpRequest::create('/', 'GET', $query);
        $httpRequest->setUserResolver(fn () => $user);
        $httpRequest->attributes->set('archive_user', $user);

        $response = app()->call([app($controller), $method], ['request' => $httpRequest, ...$routeParameters]);

        return json_decode($response->getContent(), true) ?? [];
    }
}
