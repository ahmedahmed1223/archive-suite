<?php

namespace Tests\Feature;

use App\Models\ApiSession;
use App\Models\User;
use App\Support\ApiToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_logs_in_sets_refresh_cookie_and_allows_bearer_access(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])
            ->assertOk()
            ->assertCookie('va_refresh')
            ->assertCookie('va_session')
            ->assertJsonPath('ok', true)
            ->assertJsonPath('user.email', 'admin@example.test');

        $accessToken = $login->json('accessToken');
        $this->assertIsString($accessToken);

        $this->getJson('/api/v1/auth/me', [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'admin@example.test');
    }

    public function test_it_rejects_invalid_login(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'wrong-password',
        ])
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_it_refreshes_and_rotates_the_refresh_cookie(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk();

        $this->assertSame(1, ApiSession::query()->count());

        $refreshCookie = $this->responseCookieValue($login, 'va_refresh');
        $this->assertIsString($refreshCookie);
        $this->assertDatabaseHas('api_sessions', [
            'refresh_token_hash' => ApiToken::hash($refreshCookie),
        ]);

        $this->call('POST', '/api/v1/auth/refresh', [], [
            'va_refresh' => $refreshCookie,
        ], [], [
            'HTTP_ACCEPT' => 'application/json',
        ])
            ->assertOk()
            ->assertCookie('va_refresh')
            ->assertJsonPath('ok', true);

        $this->assertSame(1, ApiSession::query()->count());
    }

    public function test_refresh_cookie_is_scoped_to_the_refresh_route_path(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk();

        $cookie = $this->responseCookie($login, 'va_refresh');
        $this->assertNotNull($cookie);
        $this->assertSame('/api/v1/auth/refresh', $cookie->getPath());
    }

    public function test_login_issues_a_root_scoped_presence_cookie_without_broadening_the_refresh_cookie(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk();

        $this->assertSame('/api/v1/auth/refresh', $this->responseCookie($login, 'va_refresh')?->getPath());
        $this->assertSame('/', $this->responseCookie($login, 'va_session')?->getPath());
    }

    public function test_refresh_rejects_a_disallowed_origin(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk();

        $refreshCookie = $this->responseCookieValue($login, 'va_refresh');

        $this->call('POST', '/api/v1/auth/refresh', [], [
            'va_refresh' => $refreshCookie,
        ], [], [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_ORIGIN' => 'https://evil.example.test',
        ])
            ->assertStatus(403)
            ->assertJsonPath('ok', false);
    }

    public function test_refresh_allows_the_configured_frontend_origin(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk();

        $refreshCookie = $this->responseCookieValue($login, 'va_refresh');

        $this->call('POST', '/api/v1/auth/refresh', [], [
            'va_refresh' => $refreshCookie,
        ], [], [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_ORIGIN' => 'http://localhost:3000',
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_refresh_is_throttled_after_repeated_attempts(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        for ($i = 0; $i < 30; $i++) {
            $this->call('POST', '/api/v1/auth/refresh', [], [
                'va_refresh' => 'not-a-real-token',
            ], [], [
                'HTTP_ACCEPT' => 'application/json',
            ])->assertUnauthorized();
        }

        $this->call('POST', '/api/v1/auth/refresh', [], [
            'va_refresh' => 'not-a-real-token',
        ], [], [
            'HTTP_ACCEPT' => 'application/json',
        ])->assertStatus(429);
    }

    public function test_it_logs_out_and_revokes_the_session(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk();

        $accessToken = $login->json('accessToken');

        $this->postJson('/api/v1/auth/logout', [], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertCookieExpired('va_refresh');

        $this->assertSame(0, ApiSession::query()->count());
    }

    private function responseCookieValue(mixed $response, string $name): ?string
    {
        return $this->responseCookie($response, $name)?->getValue();
    }

    private function responseCookie(mixed $response, string $name): ?\Symfony\Component\HttpFoundation\Cookie
    {
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === $name) {
                return $cookie;
            }
        }

        return null;
    }
}
