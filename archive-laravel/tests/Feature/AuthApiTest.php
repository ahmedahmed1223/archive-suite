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
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === $name) {
                return $cookie->getValue();
            }
        }

        return null;
    }
}
