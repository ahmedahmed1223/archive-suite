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

        return response()->json(['ok' => true])->withoutCookie($this->cookieName());
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
        ], $status)->withCookie($this->refreshCookie($refreshToken, $refreshExpiresAt));
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
            'roles' => [],
        ];
    }

    private function cookieName(): string
    {
        return (string) config('archive.auth.refresh_cookie');
    }
}
