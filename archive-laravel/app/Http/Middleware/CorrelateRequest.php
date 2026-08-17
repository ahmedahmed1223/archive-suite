<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class CorrelateRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        $candidate = (string) $request->headers->get('X-Request-ID', '');
        $requestId = preg_match('/^[A-Za-z0-9._:-]{1,128}$/', $candidate) === 1
            ? $candidate
            : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);
        Log::withContext(['request_id' => $requestId]);

        $startedAt = microtime(true);
        $response = $next($request);
        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

        $response->headers->set('X-Request-ID', $requestId);

        $this->logIfSlow($request, $response, $requestId, $durationMs);

        return $response;
    }

    /**
     * Allowlisted metadata only -- never the request/response body, headers,
     * query string, or a filesystem path. `route` is the route pattern
     * (e.g. "api/v1/records/{id}"), matching the convention already used by
     * AuditArchiveApiRequest, not the resolved path with real values.
     */
    private function logIfSlow(Request $request, Response $response, string $requestId, int $durationMs): void
    {
        $threshold = (int) config('observability.slow_request_threshold_ms', 1000);
        if ($durationMs < $threshold) {
            return;
        }

        Log::warning('slow_request', [
            'request_id' => $requestId,
            'method' => $request->method(),
            'route' => $request->route()?->uri() ?? $request->path(),
            'status' => $response->getStatusCode(),
            'duration_ms' => $durationMs,
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
