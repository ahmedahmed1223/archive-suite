<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditArchiveApiRequest
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethodSafe()) {
            AuditLog::query()->create([
                'action' => $request->method().' /'.$request->path(),
                'status_code' => $response->getStatusCode(),
                'metadata' => [
                    'route' => $request->route()?->uri(),
                    'query' => $request->query(),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        }

        return $response;
    }
}
