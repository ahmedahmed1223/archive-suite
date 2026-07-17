<?php

namespace App\Http\Middleware;

use App\Models\ApiSession;
use App\Models\User;
use App\Support\ApiError;
use App\Support\ApiToken;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateArchiveApiRequest
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response|JsonResponse
    {
        // V1-759: API keys are a distinct bearer credential from session
        // access tokens (different table, capped role) — tried first so a
        // key never falls through to the session lookup below.
        if ($this->authenticateApiKey($request)) {
            return $next($request);
        }

        $session = $this->sessionFromBearer($request) ?? $this->sessionFromCookie($request);

        // In tests, actingAs() sets up Laravel's auth guard; support it as fallback
        if (! $session && app()->runningUnitTests() && auth()->check()) {
            $session = new ApiSession(['user_id' => auth()->id()]);
            $session->setRelation('user', auth()->user());
        }

        if (! $session) {
            return response()->json(ApiError::envelope('Unauthorized.', 401), 401);
        }

        // Only save if this is a real persisted session (not a test session)
        if ($session->exists) {
            $session->forceFill(['last_used_at' => now()])->save();
        }

        $request->attributes->set('archive_session', $session);
        $request->attributes->set('archive_user', $session->user);

        return $next($request);
    }

    /**
     * V1-759: authenticate via an admin-issued API key instead of a login
     * session. On match, sets archive_user to a clone of the key's owner
     * with role overridden to the key's own (creation-time capped to
     * editor|viewer) role — the owner's real role never grants more than
     * that through a key, and archive_user->getKey() still resolves to a
     * real users.id for any actor/created_by FK downstream.
     */
    private function authenticateApiKey(Request $request): bool
    {
        $token = $request->bearerToken();

        if (! is_string($token) || $token === '') {
            return false;
        }

        $row = DB::table('api_keys')->where('token_hash', ApiToken::hash($token))->first();

        if (! $row) {
            return false;
        }

        $owner = User::query()->find($row->user_id);

        if (! $owner) {
            return false;
        }

        DB::table('api_keys')->where('id', $row->id)->update(['last_used_at' => now()]);

        $effectiveUser = clone $owner;
        $effectiveUser->role = $row->role;

        $request->attributes->set('archive_user', $effectiveUser);
        $request->attributes->set('archive_api_key_id', $row->id);

        return true;
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
