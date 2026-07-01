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

    private function getDefaultLimit(): int
    {
        $limit = (int) ($this->config['table_limit'] ?? 25);

        return max(1, min($limit, 250));
    }
}
