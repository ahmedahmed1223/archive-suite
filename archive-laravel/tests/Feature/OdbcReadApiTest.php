<?php

namespace Tests\Feature;

use App\Services\Odbc\OdbcConnection;
use App\Services\Odbc\OdbcConnectionFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class OdbcReadApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_odbc_read_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/v1/system/odbc/tables/items')
            ->assertUnauthorized();
    }

    public function test_odbc_read_returns_rows_from_allowed_table(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $response = $this->getJson(
            '/api/v1/system/odbc/tables/items?limit=5',
            $this->authHeaders()
        );

        $response
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('table', 'items')
            ->assertJsonPath('count', 5);

        $this->assertCount(5, $response->json('rows'));
        $this->assertSame('Item 1', $response->json('rows.0.name'));
    }

    public function test_odbc_read_rejects_disallowed_table(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->getJson(
            '/api/v1/system/odbc/tables/admin_secrets',
            $this->authHeaders()
        )
            ->assertForbidden()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('error', 'Table access denied.');
    }

    public function test_odbc_read_masks_password_columns(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $response = $this->getJson(
            '/api/v1/system/odbc/tables/users?limit=1',
            $this->authHeaders()
        );

        $response->assertOk();

        $row = $response->json('rows.0');
        $this->assertSame('alice', $row['username']);
        $this->assertSame('***MASKED***', $row['password_hash'] ?? null);
    }

    public function test_odbc_read_respects_limit_parameter(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $response = $this->getJson(
            '/api/v1/system/odbc/tables/items?limit=10',
            $this->authHeaders()
        );

        $response->assertOk();
        $this->assertCount(10, $response->json('rows'));
    }

    public function test_odbc_read_defaults_to_config_limit(): void
    {
        config(['odbc.table_limit' => 15]);
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $response = $this->getJson(
            '/api/v1/system/odbc/tables/items',
            $this->authHeaders()
        );

        $response->assertOk();
        $this->assertCount(15, $response->json('rows'));
    }

    public function test_odbc_read_enforces_max_limit(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $response = $this->getJson(
            '/api/v1/system/odbc/tables/items?limit=999',
            $this->authHeaders()
        );

        $response->assertOk();
        $this->assertLessThanOrEqual(250, count($response->json('rows')));
    }
}

class OdbcReadFeatureFakeFactory implements OdbcConnectionFactory
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
        return new OdbcReadFeatureFakeConnection();
    }
}

class OdbcReadFeatureFakeConnection implements OdbcConnection
{
    /**
     * @return string[]
     */
    public function tableNames(int $limit): array
    {
        return array_slice(['items', 'users', 'settings', 'audit'], 0, $limit);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function readRows(string $table, int $offset, int $limit): array
    {
        if ($table === 'items') {
            $rows = [];
            for ($i = 1; $i <= 100; $i++) {
                $rows[] = [
                    'id' => $i,
                    'name' => "Item {$i}",
                    'created_at' => '2026-01-01 00:00:00',
                ];
            }

            return array_slice($rows, $offset, $limit);
        }

        if ($table === 'users') {
            return array_slice([
                [
                    'id' => 1,
                    'username' => 'alice',
                    'email' => 'alice@archive.local',
                    'password_hash' => 'bcrypt_here',
                ],
            ], $offset, $limit);
        }

        if ($table === 'settings') {
            return array_slice([
                ['key' => 'app_name', 'value' => 'Archive Suite'],
            ], $offset, $limit);
        }

        if ($table === 'audit') {
            return array_slice([
                ['action' => 'login', 'user_id' => 1, 'timestamp' => '2026-01-01 10:00:00'],
            ], $offset, $limit);
        }

        return [];
    }
}
