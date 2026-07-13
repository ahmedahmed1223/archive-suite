<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ApiError;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1 TASKS.md: stable machine-readable `code` alongside the existing
 * human-readable `error` string in the {ok:false, error, code} envelope.
 * `error` text is never asserted here to change — only that `code` is now
 * present and correct, so the Next.js pages can branch on it instead of
 * matching the English string.
 */
class ErrorCodeContractTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_unauthenticated_request_has_unauthenticated_code(): void
    {
        $this->getJson('/api/v1/records?store=default')
            ->assertStatus(401)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'UNAUTHENTICATED');
    }

    public function test_forbidden_request_has_forbidden_code(): void
    {
        $viewer = User::query()->create([
            'name' => 'Viewer',
            'email' => 'contract-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $viewer->email,
            'password' => 'secret-password',
        ])->assertOk();

        $this->postJson('/api/v1/system/control/clear-cache', [], [
            'Authorization' => 'Bearer '.$login->json('accessToken'),
        ])
            ->assertStatus(403)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'FORBIDDEN');
    }

    public function test_undefined_route_has_not_found_code(): void
    {
        $this->getJson('/api/v1/this-route-does-not-exist')
            ->assertStatus(404)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_framework_validation_failure_has_validation_failed_code(): void
    {
        // Omits the required "store" query param so $request->validate()
        // throws uncaught — exercises the central bootstrap/app.php renderer,
        // not a controller-level try/catch.
        $this->getJson('/api/v1/records', $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['errors']);
    }

    public function test_login_rate_limit_has_rate_limited_code(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'rate-limit-contract@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        foreach (range(1, 10) as $attempt) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'rate-limit-contract@example.test',
                'password' => 'wrong-password',
            ])->assertUnauthorized();
        }

        $this->postJson('/api/v1/auth/login', [
            'email' => 'rate-limit-contract@example.test',
            'password' => 'wrong-password',
        ])
            ->assertStatus(429)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'RATE_LIMITED');
    }

    public function test_production_server_error_hides_internal_message_and_has_server_error_code(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $response = ApiError::renderException(
            new RuntimeException('leaked: postgres://user:secret@internal-host/db'),
            Request::create('/api/v1/whatever', 'GET'),
        );

        $data = $response->getData(true);

        $this->assertSame(500, $response->getStatusCode());
        $this->assertFalse($data['ok']);
        $this->assertSame('SERVER_ERROR', $data['code']);
        $this->assertSame('Server error.', $data['error']);
        $this->assertStringNotContainsString('postgres://', json_encode($data));
        $this->assertStringNotContainsString('secret', json_encode($data));
    }

    public function test_non_production_server_error_keeps_real_message_with_server_error_code(): void
    {
        $this->app->detectEnvironment(fn () => 'local');

        $response = ApiError::renderException(
            new RuntimeException('disk full at /var/data'),
            Request::create('/api/v1/whatever', 'GET'),
        );

        $data = $response->getData(true);

        $this->assertSame(500, $response->getStatusCode());
        $this->assertSame('SERVER_ERROR', $data['code']);
        $this->assertSame('disk full at /var/data', $data['error']);
    }
}
