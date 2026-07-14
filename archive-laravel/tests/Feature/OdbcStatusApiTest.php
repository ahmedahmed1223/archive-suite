<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Odbc\OdbcConnection;
use App\Services\Odbc\OdbcConnectionFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class OdbcStatusApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_odbc_status_requires_authentication(): void
    {
        $this->getJson('/api/v1/system/odbc')
            ->assertUnauthorized();
    }

    public function test_odbc_status_returns_probe_summary_for_authenticated_admin(): void
    {
        config([
            'odbc.enabled' => true,
            'odbc.dsn' => 'LegacyArchive;PWD=secret',
            'odbc.username' => 'legacy_user',
            'odbc.password' => 'secret',
        ]);

        $this->app->bind(OdbcConnectionFactory::class, fn () => new FeatureFakeOdbcConnectionFactory());

        // V1-102G: ODBC is admin-only — authHeaders() is editor-role (see
        // AuthenticatesArchiveRequests) and would now 403 despite this
        // test's name always having claimed "admin".
        $this->getJson('/api/v1/system/odbc', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('odbc.status', 'connected')
            ->assertJsonPath('odbc.dsn', 'LegacyArchive;PWD=***')
            ->assertJsonPath('odbc.tables.0', 'archive_items');
    }

    public function test_odbc_status_is_forbidden_for_non_admin_roles(): void
    {
        config(['odbc.enabled' => true]);
        $this->app->bind(OdbcConnectionFactory::class, fn () => new FeatureFakeOdbcConnectionFactory());

        $this->getJson('/api/v1/system/odbc', $this->authHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'odbc-status-admin@example.test'],
            [
                'name' => 'Odbc Status Admin',
                'password' => Hash::make('secret-password'),
                'role' => 'admin',
            ],
        );

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }
}

class FeatureFakeOdbcConnectionFactory implements OdbcConnectionFactory
{
    /**
     * @return string[]
     */
    public function availableDrivers(): array
    {
        return ['odbc'];
    }

    public function connect(string $dsn, ?string $username, ?string $password): OdbcConnection
    {
        return new FeatureFakeOdbcConnection();
    }
}

class FeatureFakeOdbcConnection implements OdbcConnection
{
    /**
     * @return string[]
     */
    public function tableNames(int $limit): array
    {
        return array_slice(['archive_items', 'users'], 0, $limit);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function readRows(string $table, int $offset, int $limit): array
    {
        return [];
    }

    public function insertRow(string $table, array $values): int
    {
        return 0;
    }

    public function updateRow(string $table, string $keyColumn, mixed $keyValue, array $values): int
    {
        return 0;
    }

    public function deleteRow(string $table, string $keyColumn, mixed $keyValue): int
    {
        return 0;
    }
}
