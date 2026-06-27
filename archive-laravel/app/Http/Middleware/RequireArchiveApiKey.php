<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireArchiveApiKey
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response|JsonResponse
    {
        $expected = config('archive.api_key');

        if (! is_string($expected) || $expected === '') {
            return response()->json([
                'ok' => false,
                'error' => 'Archive API key is not configured.',
            ], 503);
        }

        $provided = $request->header('X-Archive-Api-Key') ?: $request->bearerToken();

        if (! is_string($provided) || ! hash_equals($expected, $provided)) {
            return response()->json([
                'ok' => false,
                'error' => 'Unauthorized.',
            ], 401);
        }

        return $next($request);
    }
}
