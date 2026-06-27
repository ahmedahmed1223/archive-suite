<?php

namespace App\Http\Middleware;

use App\Models\ApiSession;
use App\Support\ApiToken;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateArchiveApiRequest
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response|JsonResponse
    {
        if ($this->authenticateApiKey($request)) {
            return $next($request);
        }

        $session = $this->sessionFromBearer($request) ?? $this->sessionFromCookie($request);

        if (! $session) {
            return response()->json(['ok' => false, 'error' => 'Unauthorized.'], 401);
        }

        $session->forceFill(['last_used_at' => now()])->save();
        $request->attributes->set('archive_session', $session);
        $request->attributes->set('archive_user', $session->user);

        return $next($request);
    }

    private function authenticateApiKey(Request $request): bool
    {
        $expected = config('archive.api_key');

        if (! is_string($expected) || $expected === '') {
            return false;
        }

        $provided = $request->header('X-Archive-Api-Key');

        return is_string($provided) && hash_equals($expected, $provided);
    }

    private function sessionFromBearer(Request $request): ?ApiSession
    {
        $token = $request->bearerToken();

        if (! is_string($token) || $token === '') {
            return null;
        }

        return ApiSession::query()
            ->where('access_token_hash', ApiToken::hash($token))
            ->where('access_expires_at', '>', now())
            ->first();
    }

    private function sessionFromCookie(Request $request): ?ApiSession
    {
        $token = $request->cookie((string) config('archive.auth.refresh_cookie'));

        if (! is_string($token) || $token === '') {
            return null;
        }

        return ApiSession::query()
            ->where('refresh_token_hash', ApiToken::hash($token))
            ->where('refresh_expires_at', '>', now())
            ->first();
    }
}
