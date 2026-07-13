<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * V1-001: gates experimental/hidden route groups behind config('archive.features.*').
 * Off routes 404 rather than 403 — an unannounced surface should look like it
 * doesn't exist, not like a permission problem.
 */
class FeatureGate
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next, string $flag): Response|JsonResponse
    {
        if (! (bool) config("archive.features.{$flag}")) {
            return response()->json([
                'ok' => false,
                'error' => 'Not found.',
            ], 404);
        }

        return $next($request);
    }
}
