<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Odbc\OdbcConnection;
use App\Services\Odbc\OdbcConnectionFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1-102G: ODBC is a raw external-database proxy, so every action (probe,
 * read, write) is admin-only via Controller::requireAdmin(), not just
 * feature-flagged. authHeaders() from AuthenticatesArchiveRequests is
 * editor-role by design (see that trait's doc-comment) and is intentionally
 * not used here anymore -- see adminHeaders()/editorHeaders()/viewerHeaders().
 */
class OdbcReadApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_odbc_read_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/v1/system/odbc/tables/items')
            ->assertUnauthorized();
    }

    // -- role coverage (V1-102G: ODBC is admin-only, not just feature-flagged) --

    public function test_viewer_cannot_probe_odbc(): void
    {
        $this->getJson('/api/v1/system/odbc', $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_editor_cannot_probe_odbc(): void
    {
        $this->getJson('/api/v1/system/odbc', $this->editorHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_viewer_cannot_read_an_odbc_table(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->getJson('/api/v1/system/odbc/tables/items', $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_editor_cannot_read_an_odbc_table(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->getJson('/api/v1/system/odbc/tables/items', $this->editorHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_viewer_cannot_write_an_odbc_row(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->postJson(
            '/api/v1/system/odbc/tables/items/rows',
            ['values' => ['id' => 101, 'name' => 'Viewer attempt']],
            $this->viewerHeaders()
        )->assertForbidden();

        $this->patchJson(
            '/api/v1/system/odbc/tables/settings/rows',
            ['keyColumn' => 'key', 'keyValue' => 'app_name', 'values' => ['value' => 'Hijacked']],
            $this->viewerHeaders()
        )->assertForbidden();

        $this->deleteJson(
            '/api/v1/system/odbc/tables/items/rows',
            ['keyColumn' => 'id', 'keyValue' => 10],
            $this->viewerHeaders()
        )->assertForbidden();
    }

    public function test_editor_cannot_write_an_odbc_row(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->postJson(
            '/api/v1/system/odbc/tables/items/rows',
            ['values' => ['id' => 101, 'name' => 'Editor attempt']],
            $this->editorHeaders()
        )->assertForbidden();

        $this->patchJson(
            '/api/v1/system/odbc/tables/settings/rows',
            ['keyColumn' => 'key', 'keyValue' => 'app_name', 'values' => ['value' => 'Hijacked']],
            $this->editorHeaders()
        )->assertForbidden();

        $this->deleteJson(
            '/api/v1/system/odbc/tables/items/rows',
            ['keyColumn' => 'id', 'keyValue' => 10],
            $this->editorHeaders()
        )->assertForbidden();
    }

    public function test_odbc_read_returns_rows_from_allowed_table(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $response = $this->getJson(
            '/api/v1/system/odbc/tables/items?limit=5',
            $this->adminHeaders()
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
            $this->adminHeaders()
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
            $this->adminHeaders()
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
            $this->adminHeaders()
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
            $this->adminHeaders()
        );

        $response->assertOk();
        $this->assertCount(15, $response->json('rows'));
    }

    public function test_odbc_read_enforces_max_limit(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $response = $this->getJson(
            '/api/v1/system/odbc/tables/items?limit=999',
            $this->adminHeaders()
        );

        $response->assertOk();
        $this->assertLessThanOrEqual(250, count($response->json('rows')));
    }

    public function test_odbc_create_row_returns_write_result(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->postJson(
            '/api/v1/system/odbc/tables/items/rows',
            ['values' => ['id' => 101, 'name' => 'New item']],
            $this->adminHeaders()
        )
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('table', 'items')
            ->assertJsonPath('operation', 'insert')
            ->assertJsonPath('affected', 1);
    }

    public function test_odbc_update_row_requires_allowed_key(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->patchJson(
            '/api/v1/system/odbc/tables/users/rows',
            ['keyColumn' => 'email', 'keyValue' => 'alice@example.test', 'values' => ['display_name' => 'Alice']],
            $this->adminHeaders()
        )
            ->assertUnprocessable()
            ->assertJsonPath('ok', false);
    }

    public function test_odbc_update_row_returns_write_result(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->patchJson(
            '/api/v1/system/odbc/tables/settings/rows',
            ['keyColumn' => 'key', 'keyValue' => 'app_name', 'values' => ['value' => 'Masar']],
            $this->adminHeaders()
        )
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('operation', 'update')
            ->assertJsonPath('affected', 1);
    }

    public function test_odbc_delete_row_returns_write_result(): void
    {
        $this->app->bind(OdbcConnectionFactory::class, fn () => new OdbcReadFeatureFakeFactory());

        $this->deleteJson(
            '/api/v1/system/odbc/tables/items/rows',
            ['keyColumn' => 'id', 'keyValue' => 10],
            $this->adminHeaders()
        )
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('operation', 'delete')
            ->assertJsonPath('affected', 1);
    }

    // -- role helpers ---------------------------------------------------------

    /**
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        return $this->odbcHeadersFor('admin', 'odbc-admin@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function editorHeaders(): array
    {
        return $this->odbcHeadersFor('editor', 'odbc-editor@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        return $this->odbcHeadersFor('viewer', 'odbc-viewer@example.test');
    }

    /**
     * @return array<string, string>
     */
    private function odbcHeadersFor(string $role, string $email): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => ucfirst($role),
                'password' => Hash::make('secret-password'),
                'role' => $role,
            ],
        );

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
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

    public function insertRow(string $table, array $values): int
    {
        return 1;
    }

    public function updateRow(string $table, string $keyColumn, mixed $keyValue, array $values): int
    {
        return 1;
    }

    public function deleteRow(string $table, string $keyColumn, mixed $keyValue): int
    {
        return 1;
    }
}
