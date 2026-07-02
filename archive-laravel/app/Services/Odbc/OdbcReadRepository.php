<?php

declare(strict_types=1);

namespace App\Services\Odbc;

class OdbcReadRepository
{
    /**
     * Core tables allowed for read-only access.
     *
     * @var string[]
     */
    private const ALLOWED_TABLES = [
        'items',
        'users',
        'settings',
        'audit',
    ];

    /**
     * Row identity columns allowed for update/delete operations.
     *
     * @var array<string, string[]>
     */
    private const KEY_COLUMNS = [
        'items' => ['id', 'uid'],
        'users' => ['id', 'username'],
        'settings' => ['key'],
        'audit' => ['id'],
    ];

    /**
     * Column name patterns that should be masked (case-insensitive).
     *
     * @var string[]
     */
    private const MASKED_COLUMNS = [
        'password',
        'password_hash',
        'pwd',
        'secret',
        'token',
        'api_key',
        'refresh_token',
    ];

    /**
     * Columns that may never be written through the ODBC bridge.
     *
     * @var string[]
     */
    private const PROTECTED_WRITE_COLUMNS = [
        'password',
        'password_hash',
        'pwd',
        'secret',
        'token',
        'api_key',
        'refresh_token',
    ];

    /**
     * @param  array<string, mixed>  $config
     */
    public function __construct(
        private readonly OdbcConnection $connection,
        private readonly array $config = [],
    ) {}

    /**
     * Get list of allowed core tables.
     *
     * @return string[]
     */
    public function getAllowedCoreTables(): array
    {
        return self::ALLOWED_TABLES;
    }

    /**
     * @return string[]
     */
    public function getAllowedKeyColumns(string $table): array
    {
        return self::KEY_COLUMNS[$table] ?? [];
    }

    /**
     * Read rows from an allowed table with pagination.
     *
     * @return array<int, array<string, mixed>>
     */
    public function readRows(string $table, ?int $limit = null): array
    {
        // Check allowlist
        if (! in_array($table, self::ALLOWED_TABLES, true)) {
            return [];
        }

        $limit = $limit ?? $this->getDefaultLimit();
        $limit = max(1, min($limit, 250));
        $offset = 0;

        $rows = $this->connection->readRows($table, $offset, $limit);

        return $this->maskSensitiveColumns($rows);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array{affected: int}
     */
    public function insertRow(string $table, array $values): array
    {
        $this->assertAllowedTable($table);
        $values = $this->validateWriteValues($values);

        return ['affected' => $this->connection->insertRow($table, $values)];
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array{affected: int}
     */
    public function updateRow(string $table, string $keyColumn, mixed $keyValue, array $values): array
    {
        $this->assertAllowedTable($table);
        $this->assertAllowedKeyColumn($table, $keyColumn);
        $this->assertScalarValue('keyValue', $keyValue);
        $values = $this->validateWriteValues($values, [$keyColumn]);

        return ['affected' => $this->connection->updateRow($table, $keyColumn, $keyValue, $values)];
    }

    /**
     * @return array{affected: int}
     */
    public function deleteRow(string $table, string $keyColumn, mixed $keyValue): array
    {
        $this->assertAllowedTable($table);
        $this->assertAllowedKeyColumn($table, $keyColumn);
        $this->assertScalarValue('keyValue', $keyValue);

        return ['affected' => $this->connection->deleteRow($table, $keyColumn, $keyValue)];
    }

    /**
     * Mask sensitive column values in row data.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private function maskSensitiveColumns(array $rows): array
    {
        return array_map(function (array $row): array {
            foreach ($row as $key => $value) {
                if ($this->isPasswordLikeColumn($key)) {
                    $row[$key] = '***MASKED***';
                }
            }

            return $row;
        }, $rows);
    }

    private function isPasswordLikeColumn(string $columnName): bool
    {
        $lower = strtolower($columnName);

        return in_array($lower, self::MASKED_COLUMNS, true)
            || str_contains($lower, 'pass')
            || str_contains($lower, 'secret')
            || str_contains($lower, 'token')
            || str_contains($lower, 'key');
    }

    private function isProtectedWriteColumn(string $columnName): bool
    {
        $lower = strtolower($columnName);

        return in_array($lower, self::PROTECTED_WRITE_COLUMNS, true)
            || str_contains($lower, 'pass')
            || str_contains($lower, 'secret')
            || str_contains($lower, 'token')
            || str_contains($lower, 'api_key');
    }

    private function assertAllowedTable(string $table): void
    {
        if (! in_array($table, self::ALLOWED_TABLES, true)) {
            throw new \InvalidArgumentException('Table access denied.');
        }
    }

    private function assertAllowedKeyColumn(string $table, string $keyColumn): void
    {
        $this->assertIdentifier($keyColumn, 'key column');

        if (! in_array($keyColumn, $this->getAllowedKeyColumns($table), true)) {
            throw new \InvalidArgumentException("Column {$keyColumn} is not a permitted key for {$table}.");
        }
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  string[]  $disallowedColumns
     * @return array<string, mixed>
     */
    private function validateWriteValues(array $values, array $disallowedColumns = []): array
    {
        if ($values === []) {
            throw new \InvalidArgumentException('At least one writable column is required.');
        }

        $validated = [];
        foreach ($values as $column => $value) {
            if (! is_string($column)) {
                throw new \InvalidArgumentException('Column names must be strings.');
            }

            $this->assertIdentifier($column, 'column');

            if (in_array($column, $disallowedColumns, true)) {
                throw new \InvalidArgumentException("Column {$column} cannot be updated as a value.");
            }

            if ($this->isProtectedWriteColumn($column)) {
                throw new \InvalidArgumentException("Column {$column} is not writable.");
            }

            $this->assertScalarValue($column, $value);
            $validated[$column] = $value;
        }

        return $validated;
    }

    private function assertIdentifier(string $identifier, string $label): void
    {
        if (! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $identifier)) {
            throw new \InvalidArgumentException("Invalid {$label} name.");
        }
    }

    private function assertScalarValue(string $label, mixed $value): void
    {
        if (
            $value !== null
            && ! is_string($value)
            && ! is_int($value)
            && ! is_float($value)
            && ! is_bool($value)
        ) {
            throw new \InvalidArgumentException("Column {$label} must be a scalar value.");
        }
    }

    private function getDefaultLimit(): int
    {
        $limit = (int) ($this->config['table_limit'] ?? 25);

        return max(1, min($limit, 250));
    }
}
