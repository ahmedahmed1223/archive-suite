<?php

namespace Tests\Unit;

use App\Services\Odbc\OdbcConnection;
use App\Services\Odbc\OdbcReadRepository;
use PHPUnit\Framework\TestCase;

class OdbcReadRepositoryTest extends TestCase
{
    public function test_get_allowed_core_tables_returns_filtered_list(): void
    {
        $repository = new OdbcReadRepository(new FakeOdbcReadConnection());

        $tables = $repository->getAllowedCoreTables();

        $this->assertSame(['items', 'users', 'settings', 'audit'], $tables);
    }

    public function test_read_rows_from_allowed_table_respects_limit(): void
    {
        $repository = new OdbcReadRepository(new FakeOdbcReadConnection());

        $rows = $repository->readRows('items', 10);

        $this->assertCount(10, $rows);
        $this->assertSame('Item 1', $rows[0]['name']);
        $this->assertSame('Item 10', $rows[9]['name']);
    }

    public function test_read_rows_returns_empty_for_disallowed_table(): void
    {
        $repository = new OdbcReadRepository(new FakeOdbcReadConnection());

        $rows = $repository->readRows('admin_secrets', 5);

        $this->assertEmpty($rows);
    }

    public function test_read_rows_masks_password_like_columns(): void
    {
        $connection = new FakeOdbcReadConnection();
        $connection->setRowsForTable('users', [
            [
                'id' => 1,
                'username' => 'alice',
                'password_hash' => 'bcrypt_hash_here',
                'password' => 'plaintext_secret',
                'pwd' => 'also_secret',
            ],
        ]);

        $repository = new OdbcReadRepository($connection);

        $rows = $repository->readRows('users', 10);

        $this->assertCount(1, $rows);
        $this->assertSame('alice', $rows[0]['username']);
        $this->assertSame('***MASKED***', $rows[0]['password_hash']);
        $this->assertSame('***MASKED***', $rows[0]['password']);
        $this->assertSame('***MASKED***', $rows[0]['pwd']);
    }

    public function test_read_rows_defaults_to_config_limit(): void
    {
        $connection = new FakeOdbcReadConnection();
        $connection->setRowCount(100);

        $repository = new OdbcReadRepository($connection, ['table_limit' => 25]);

        $rows = $repository->readRows('items', null);

        $this->assertCount(25, $rows);
    }

    public function test_read_rows_enforces_max_limit_of_250(): void
    {
        $connection = new FakeOdbcReadConnection();

        // Add 500 rows to the fake connection
        $items = [];
        for ($i = 1; $i <= 500; $i++) {
            $items[] = [
                'id' => $i,
                'name' => "Item {$i}",
                'created_at' => '2026-01-01 00:00:00',
            ];
        }
        $connection->setRowsForTable('items', $items);

        $repository = new OdbcReadRepository($connection);

        $rows = $repository->readRows('items', 1000);

        $this->assertCount(250, $rows);
    }
}

class FakeOdbcReadConnection implements OdbcConnection
{
    /**
     * @var array<string, array<int, array<string, mixed>>>
     */
    private array $tableData = [];

    private int $rowCount = 100;

    public function __construct()
    {
        // Setup default table data
        $items = [];
        for ($i = 1; $i <= 100; $i++) {
            $items[] = [
                'id' => $i,
                'name' => "Item {$i}",
                'created_at' => '2026-01-01 00:00:00',
            ];
        }

        $users = [];
        for ($i = 1; $i <= 50; $i++) {
            $users[] = [
                'id' => $i,
                'username' => "user{$i}",
                'email' => "user{$i}@archive.local",
            ];
        }

        $this->tableData = [
            'items' => $items,
            'users' => $users,
            'settings' => [
                ['key' => 'app_name', 'value' => 'Archive Suite'],
            ],
            'audit' => [
                ['action' => 'login', 'user_id' => 1, 'timestamp' => '2026-01-01 10:00:00'],
            ],
        ];
    }

    public function setRowsForTable(string $table, array $rows): void
    {
        $this->tableData[$table] = $rows;
    }

    public function setRowCount(int $count): void
    {
        $this->rowCount = $count;
    }

    /**
     * @return string[]
     */
    public function tableNames(int $limit): array
    {
        return array_slice(array_keys($this->tableData), 0, $limit);
    }

    /**
     * Read rows from a specific table (fake implementation).
     *
     * @return array<int, array<string, mixed>>
     */
    public function readRows(string $table, int $offset, int $limit): array
    {
        if (! isset($this->tableData[$table])) {
            return [];
        }

        return array_slice($this->tableData[$table], $offset, $limit);
    }
}
