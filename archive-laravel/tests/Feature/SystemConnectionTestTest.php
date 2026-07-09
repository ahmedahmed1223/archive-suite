<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SystemConnectionTestTest extends TestCase
{
    use RefreshDatabase;

    public function test_test_storage_connection_local_succeeds(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/system/test-storage', [
            'driver' => 'local',
            'name' => 'test-storage',
            'config' => [
                'root' => storage_path('app'),
            ],
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('connection.status', 'connected');
        $response->assertJsonPath('connection.driver', 'local');
        $response->assertJsonPath('connection.message', 'Local storage is accessible and writable.');
    }

    public function test_test_storage_connection_local_fails_missing_path(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/system/test-storage', [
            'driver' => 'local',
            'name' => 'test-storage',
            'config' => [
                'root' => '/nonexistent/path/to/storage',
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('ok', false);
        $response->assertJsonPath('error', 'Connection test failed.');
    }

    public function test_test_storage_connection_requires_admin(): void
    {
        $response = $this->postJson('/api/v1/system/test-storage', [
            'driver' => 'local',
            'name' => 'test-storage',
            'config' => ['root' => storage_path('app')],
        ]);

        $response->assertStatus(401);
    }

    public function test_test_database_connection_mysql_succeeds(): void
    {
        $this->actingAsAdmin();

        $driver = config('database.default');
        if ($driver !== 'mysql') {
            $this->markTestSkipped('MySQL not configured');
        }

        $response = $this->postJson('/api/v1/system/test-database', [
            'driver' => 'mysql',
            'host' => config('database.connections.mysql.host'),
            'port' => config('database.connections.mysql.port'),
            'database' => config('database.connections.mysql.database'),
            'username' => config('database.connections.mysql.username'),
            'password' => config('database.connections.mysql.password'),
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('connection.status', 'connected');
        $response->assertJsonPath('connection.driver', 'mysql');
    }

    public function test_test_database_connection_pgsql_succeeds(): void
    {
        $this->actingAsAdmin();

        $driver = config('database.default');
        if ($driver !== 'pgsql') {
            $this->markTestSkipped('PostgreSQL not configured');
        }

        $response = $this->postJson('/api/v1/system/test-database', [
            'driver' => 'pgsql',
            'host' => config('database.connections.pgsql.host'),
            'port' => config('database.connections.pgsql.port'),
            'database' => config('database.connections.pgsql.database'),
            'username' => config('database.connections.pgsql.username'),
            'password' => config('database.connections.pgsql.password'),
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('connection.status', 'connected');
        $response->assertJsonPath('connection.driver', 'pgsql');
    }

    public function test_test_database_connection_fails_invalid_credentials(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/system/test-database', [
            'driver' => 'mysql',
            'host' => 'localhost',
            'port' => 3306,
            'database' => 'nonexistent',
            'username' => 'invalid',
            'password' => 'wrong',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('ok', false);
        $response->assertJsonPath('error', 'Database connection test failed.');
    }

    public function test_test_database_connection_requires_admin(): void
    {
        $response = $this->postJson('/api/v1/system/test-database', [
            'driver' => 'mysql',
            'database' => 'test',
        ]);

        $response->assertStatus(401);
    }

    public function test_test_storage_connection_validates_driver(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/system/test-storage', [
            'driver' => 'invalid',
            'name' => 'test',
            'config' => [],
        ]);

        $response->assertStatus(422);
    }

    public function test_test_database_connection_validates_driver(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/system/test-database', [
            'driver' => 'invalid',
            'database' => 'test',
        ]);

        $response->assertStatus(422);
    }
}
