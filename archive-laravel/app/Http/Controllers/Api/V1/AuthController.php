<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApiSession;
use App\Models\User;
use App\Support\ApiToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class AuthController extends Controller
{
    // V1-103: the refresh cookie must only ever be sent to the refresh route
    // itself — scoping `path` here (instead of `/`) means the browser won't
    // attach it to every other API call, shrinking the CSRF/XSS blast radius.
    private const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json(['ok' => false, 'error' => 'Invalid credentials.'], 401);
        }

        return $this->issueSession($user, 200);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->attributes->get('archive_user');

        if (! $user instanceof User) {
            return response()->json(['ok' => false, 'error' => 'Unauthorized.'], 401);
        }

        return response()->json(['ok' => true, 'user' => $this->formatUser($user)]);
    }

    public function refresh(Request $request): JsonResponse
    {
        if ($rejected = $this->rejectDisallowedOrigin($request)) {
            return $rejected;
        }

        $session = $this->sessionFromRefreshCookie($request);

        if (! $session) {
            return response()->json(['ok' => false, 'error' => 'Unauthorized.'], 401);
        }

        $user = $session->user;
        $session->delete();

        return $this->issueSession($user, 200);
    }

    public function logout(Request $request): JsonResponse
    {
        $session = $request->attributes->get('archive_session') ?? $this->sessionFromRefreshCookie($request);

        if ($session instanceof ApiSession) {
            $session->delete();
        }

        return response()->json(['ok' => true])
            ->withoutCookie($this->cookieName(), self::REFRESH_COOKIE_PATH)
            ->withoutCookie($this->sessionCookieName(), '/');
    }

    /**
     * V1-103: reject cross-origin refresh attempts. Laravel's api.php routes
     * are stateless (no CSRF middleware), so a same-site cookie alone isn't
     * enough defense-in-depth — validate Origin against the same allow-list
     * already used for CORS (config('archive.security.cors_origins')).
     * Requests without an Origin header (same-origin navigations, non-browser
     * clients, curl) are allowed through — SameSite=Strict already blocks the
     * cross-site browser case that Origin checking targets.
     */
    private function rejectDisallowedOrigin(Request $request): ?JsonResponse
    {
        $origin = $request->headers->get('Origin');

        if ($origin === null || $origin === '') {
            return null;
        }

        $allowed = (array) config('archive.security.cors_origins', []);

        if (in_array($origin, $allowed, true) || $this->isLocalLoopbackOrigin($origin)) {
            return null;
        }

        return response()->json(['ok' => false, 'error' => 'Origin not allowed.'], 403);
    }

    private function isLocalLoopbackOrigin(string $origin): bool
    {
        if (! app()->environment(['local', 'testing'])) {
            return false;
        }

        return parse_url($origin, PHP_URL_SCHEME) === 'http'
            && in_array(parse_url($origin, PHP_URL_HOST), ['127.0.0.1', 'localhost', '::1'], true);
    }

    private function issueSession(User $user, int $status): JsonResponse
    {
        $accessToken = ApiToken::create();
        $refreshToken = ApiToken::create();
        $accessExpiresAt = now()->addMinutes((int) config('archive.auth.access_ttl_minutes'));
        $refreshExpiresAt = now()->addDays((int) config('archive.auth.refresh_ttl_days'));

        ApiSession::query()->create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'access_token_hash' => ApiToken::hash($accessToken),
            'refresh_token_hash' => ApiToken::hash($refreshToken),
            'access_expires_at' => $accessExpiresAt,
            'refresh_expires_at' => $refreshExpiresAt,
            'last_used_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'user' => $this->formatUser($user),
            'accessToken' => $accessToken,
            'expiresAt' => $accessExpiresAt->toISOString(),
        ], $status)
            ->withCookie($this->refreshCookie($refreshToken, $refreshExpiresAt))
            ->withCookie($this->sessionCookie($refreshExpiresAt));
    }

    private function sessionFromRefreshCookie(Request $request): ?ApiSession
    {
        $token = $request->cookie($this->cookieName());

        if (! is_string($token) || $token === '') {
            return null;
        }

        return ApiSession::query()
            ->where('refresh_token_hash', ApiToken::hash($token))
            ->where('refresh_expires_at', '>', now())
            ->first();
    }

    private function refreshCookie(string $token, mixed $expiresAt): Cookie
    {
        return cookie(
            name: $this->cookieName(),
            value: $token,
            minutes: max(1, now()->diffInMinutes($expiresAt)),
            path: self::REFRESH_COOKIE_PATH,
            domain: null,
            secure: (bool) config('archive.auth.secure_cookies'),
            httpOnly: true,
            raw: false,
            sameSite: 'Strict',
        );
    }

    private function sessionCookie(mixed $expiresAt): Cookie
    {
        return cookie(
            name: $this->sessionCookieName(),
            value: '1',
            minutes: max(1, now()->diffInMinutes($expiresAt)),
            path: '/',
            domain: null,
            secure: (bool) config('archive.auth.secure_cookies'),
            httpOnly: true,
            raw: false,
            sameSite: 'Strict',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function formatUser(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'roles' => [$user->role],
        ];
    }

    private function cookieName(): string
    {
        return (string) config('archive.auth.refresh_cookie');
    }

    private function sessionCookieName(): string
    {
        return (string) config('archive.auth.session_cookie');
    }
}
