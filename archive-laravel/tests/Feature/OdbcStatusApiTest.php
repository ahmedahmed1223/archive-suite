<?php

namespace Tests\Feature;

use App\Services\Odbc\OdbcConnection;
use App\Services\Odbc\OdbcConnectionFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

        $this->getJson('/api/v1/system/odbc', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('odbc.status', 'connected')
            ->assertJsonPath('odbc.dsn', 'LegacyArchive;PWD=***')
            ->assertJsonPath('odbc.tables.0', 'archive_items');
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
}
