<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * V2-402: archive.security.csp_policy was exposed read-only in the settings
 * UI as if it were the effective policy, but nothing ever sent it as a
 * header. Next.js's own pages enforce a real nonce-based CSP independently
 * (V2-401, generated in proxy.ts -- only the server producing the HTML can
 * mint a per-request nonce); this covers Laravel's own responses.
 */
final class ApplyCspPolicy
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $policy = (string) config('archive.security.csp_policy', '');

        if ($policy !== '') {
            $response->headers->set('Content-Security-Policy', $policy);
        }

        return $response;
    }
}
