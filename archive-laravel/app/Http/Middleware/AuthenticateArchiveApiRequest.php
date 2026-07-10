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
        $session = $this->sessionFromBearer($request) ?? $this->sessionFromCookie($request);

        // In tests, actingAs() sets up Laravel's auth guard; support it as fallback
        if (! $session && app()->runningUnitTests() && auth()->check()) {
            $session = new ApiSession(['user_id' => auth()->id()]);
            $session->setRelation('user', auth()->user());
        }

        if (! $session) {
            return response()->json(['ok' => false, 'error' => 'Unauthorized.'], 401);
        }

        // Only save if this is a real persisted session (not a test session)
        if ($session->exists) {
            $session->forceFill(['last_used_at' => now()])->save();
        }

        $request->attributes->set('archive_session', $session);
        $request->attributes->set('archive_user', $session->user);

        return $next($request);
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
