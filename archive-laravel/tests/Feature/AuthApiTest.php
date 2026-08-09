<?php

namespace Tests\Feature;

use App\Models\ApiSession;
use App\Models\User;
use App\Support\ApiToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Cookie;
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

        $this->assertSame(0, $this->responseCookie($login, 'va_refresh')?->getExpiresTime());
        $this->assertSame(0, $this->responseCookie($login, 'va_session')?->getExpiresTime());

        $accessToken = $login->json('accessToken');
        $this->assertIsString($accessToken);

        $this->getJson('/api/v1/auth/me', [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'admin@example.test');
    }

    public function test_remember_me_persists_login_cookies_across_refreshes(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
            'rememberMe' => true,
        ])->assertOk();

        $this->assertGreaterThan(now()->getTimestamp(), $this->responseCookie($login, 'va_refresh')?->getExpiresTime() ?? 0);
        $this->assertDatabaseHas('api_sessions', ['remember_me' => true]);

        $refresh = $this->call('POST', '/api/v1/auth/refresh', [], [
            'va_refresh' => $this->responseCookieValue($login, 'va_refresh'),
        ], [], ['HTTP_ACCEPT' => 'application/json'])
            ->assertOk();

        $this->assertGreaterThan(now()->getTimestamp(), $this->responseCookie($refresh, 'va_refresh')?->getExpiresTime() ?? 0);
        $this->assertDatabaseHas('api_sessions', ['remember_me' => true]);
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

    public function test_refresh_allows_the_default_ipv4_local_frontend_origin(): void
    {
        config()->set('archive.security.cors_origins', [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ]);

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
            'HTTP_ORIGIN' => 'http://127.0.0.1:3000',
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_refresh_allows_a_loopback_origin_outside_production(): void
    {
        config()->set('app.env', 'testing');
        config()->set('archive.security.cors_origins', []);

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
            'HTTP_ORIGIN' => 'http://127.0.0.1:56318',
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

        for ($i = 0; $i < 120; $i++) {
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

    private function responseCookie(mixed $response, string $name): ?Cookie
    {
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === $name) {
                return $cookie;
            }
        }

        return null;
    }
}
