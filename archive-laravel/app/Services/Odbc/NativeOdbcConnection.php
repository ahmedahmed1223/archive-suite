<?php

namespace App\Services\Odbc;

class NativeOdbcConnection implements OdbcConnection
{
    public function __construct(private readonly mixed $connection)
    {
    }

    public function __destruct()
    {
        if (function_exists('odbc_close')) {
            @odbc_close($this->connection);
        }
    }

    /**
     * @return string[]
     */
    public function tableNames(int $limit): array
    {
        if (! function_exists('odbc_tables') || ! function_exists('odbc_fetch_array')) {
            return [];
        }

        $limit = max(1, min($limit, 250));
        $result = @odbc_tables($this->connection, null, null, null, 'TABLE');
        if ($result === false) {
            return [];
        }

        $tables = [];
        while (count($tables) < $limit && ($row = odbc_fetch_array($result)) !== false) {
            $name = $row['TABLE_NAME'] ?? $row['table_name'] ?? null;
            if (is_string($name) && $name !== '') {
                $tables[] = $name;
            }
        }

        return $tables;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function readRows(string $table, int $offset, int $limit): array
    {
        if (! function_exists('odbc_exec') || ! function_exists('odbc_fetch_array')) {
            return [];
        }

        // Table name is validated against a fixed allowlist before this method is called.
        $query = "SELECT * FROM [{$table}] OFFSET {$offset} ROWS FETCH NEXT {$limit} ROWS ONLY";
        $result = @odbc_exec($this->connection, $query);
        if ($result === false) {
            return [];
        }

        $rows = [];
        while (($row = odbc_fetch_array($result)) !== false) {
            $rows[] = $row;
        }

        return $rows;
    }

    public function insertRow(string $table, array $values): int
    {
        $columns = array_keys($values);
        $columnSql = implode(', ', array_map($this->quoteIdentifier(...), $columns));
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));

        return $this->executePrepared(
            sprintf('INSERT INTO %s (%s) VALUES (%s)', $this->quoteIdentifier($table), $columnSql, $placeholders),
            array_values($values),
        );
    }

    public function updateRow(string $table, string $keyColumn, mixed $keyValue, array $values): int
    {
        $assignments = implode(', ', array_map(
            fn (string $column): string => sprintf('%s = ?', $this->quoteIdentifier($column)),
            array_keys($values),
        ));

        return $this->executePrepared(
            sprintf(
                'UPDATE %s SET %s WHERE %s = ?',
                $this->quoteIdentifier($table),
                $assignments,
                $this->quoteIdentifier($keyColumn),
            ),
            [...array_values($values), $keyValue],
        );
    }

    public function deleteRow(string $table, string $keyColumn, mixed $keyValue): int
    {
        return $this->executePrepared(
            sprintf(
                'DELETE FROM %s WHERE %s = ?',
                $this->quoteIdentifier($table),
                $this->quoteIdentifier($keyColumn),
            ),
            [$keyValue],
        );
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '['.str_replace(']', ']]', $identifier).']';
    }

    /**
     * @param  array<int, mixed>  $params
     */
    private function executePrepared(string $query, array $params): int
    {
        if (! function_exists('odbc_prepare') || ! function_exists('odbc_execute')) {
            return 0;
        }

        $statement = @odbc_prepare($this->connection, $query);
        if ($statement === false) {
            return 0;
        }

        $success = @odbc_execute($statement, $params);
        if ($success === false) {
            return 0;
        }

        if (function_exists('odbc_num_rows')) {
            $affected = @odbc_num_rows($statement);
            if (is_int($affected) && $affected >= 0) {
                return $affected;
            }
        }

        return 1;
    }
}
