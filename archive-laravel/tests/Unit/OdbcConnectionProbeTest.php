<?php

namespace Tests\Unit;

use App\Services\Odbc\OdbcConnection;
use App\Services\Odbc\OdbcConnectionFactory;
use App\Services\Odbc\OdbcConnectionProbe;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class OdbcConnectionProbeTest extends TestCase
{
    public function test_reports_disabled_without_connecting(): void
    {
        $factory = new FakeOdbcConnectionFactory(['odbc'], ['users']);
        $probe = new OdbcConnectionProbe($factory, [
            'enabled' => false,
            'dsn' => 'LegacyArchive',
        ]);

        $status = $probe->probe();

        $this->assertSame('disabled', $status['status']);
        $this->assertFalse($status['enabled']);
        $this->assertFalse($factory->connected);
    }

    public function test_reports_missing_dsn(): void
    {
        $probe = new OdbcConnectionProbe(new FakeOdbcConnectionFactory(['odbc']), [
            'enabled' => true,
            'dsn' => '',
        ]);

        $status = $probe->probe();

        $this->assertSame('missing-dsn', $status['status']);
        $this->assertTrue($status['enabled']);
    }

    public function test_reports_driver_unavailable_before_connecting(): void
    {
        $factory = new FakeOdbcConnectionFactory([]);
        $probe = new OdbcConnectionProbe($factory, [
            'enabled' => true,
            'dsn' => 'LegacyArchive',
        ]);

        $status = $probe->probe();

        $this->assertSame('driver-unavailable', $status['status']);
        $this->assertFalse($status['driverLoaded']);
        $this->assertFalse($factory->connected);
    }

    public function test_connected_status_lists_tables_and_masks_dsn_secrets(): void
    {
        $probe = new OdbcConnectionProbe(new FakeOdbcConnectionFactory(['sqlite', 'odbc'], [
            'archive_items',
            'users',
        ]), [
            'enabled' => true,
            'dsn' => 'LegacyArchive;PWD=secret;Password=hidden',
            'username' => 'legacy_user',
            'password' => 'secret',
            'table_limit' => 10,
        ]);

        $status = $probe->probe();

        $this->assertSame('connected', $status['status']);
        $this->assertSame('LegacyArchive;PWD=***;Password=***', $status['dsn']);
        $this->assertSame(['archive_items', 'users'], $status['tables']);
    }

    public function test_failed_status_sanitizes_error_message(): void
    {
        $probe = new OdbcConnectionProbe(new FakeOdbcConnectionFactory(['odbc'], [], 'Login failed for password secret'), [
            'enabled' => true,
            'dsn' => 'LegacyArchive',
            'password' => 'secret',
        ]);

        $status = $probe->probe();

        $this->assertSame('failed', $status['status']);
        $this->assertStringNotContainsString('secret', $status['error']);
    }
}

class FakeOdbcConnectionFactory implements OdbcConnectionFactory
{
    public bool $connected = false;

    /**
     * @param  string[]  $drivers
     * @param  string[]  $tables
     */
    public function __construct(
        private readonly array $drivers = [],
        private readonly array $tables = [],
        private readonly ?string $connectError = null,
    ) {}

    /**
     * @return string[]
     */
    public function availableDrivers(): array
    {
        return $this->drivers;
    }

    public function connect(string $dsn, ?string $username, ?string $password): OdbcConnection
    {
        $this->connected = true;

        if ($this->connectError !== null) {
            throw new RuntimeException($this->connectError);
        }

        return new FakeOdbcConnection($this->tables);
    }
}

class FakeOdbcConnection implements OdbcConnection
{
    /**
     * @param  string[]  $tables
     */
    public function __construct(private readonly array $tables) {}

    /**
     * @return string[]
     */
    public function tableNames(int $limit): array
    {
        return array_slice($this->tables, 0, $limit);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function readRows(string $table, int $offset, int $limit): array
    {
        return [];
    }
}
