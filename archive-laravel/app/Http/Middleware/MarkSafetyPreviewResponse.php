<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Marks every normal safety-preview response as synthetic after the route's
 * auth/controller work has completed. It has no persistence or audit side
 * effects and is deliberately registered outside archive.auth so 401s are
 * marked too.
 */
class MarkSafetyPreviewResponse
{
    /** @param Closure(Request): Response $next */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $response instanceof JsonResponse) {
            return $response;
        }

        $payload = $response->getData(true);

        if (is_array($payload)) {
            $payload['synthetic'] = true;
            $response->setData($payload);
        }

        return $response;
    }
}
