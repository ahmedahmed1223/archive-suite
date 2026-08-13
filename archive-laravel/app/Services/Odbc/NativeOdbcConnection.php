<?php

namespace App\Services\Odbc;

use App\Services\Odbc\Dialect\SqlDialect;
use App\Services\Odbc\Dialect\SqlServerDialect;
use RuntimeException;

class NativeOdbcConnection implements OdbcConnection
{
    private ?string $lastOdbcWarning = null;

    public function __construct(
        private readonly mixed $connection,
        private readonly SqlDialect $dialect = new SqlServerDialect,
    ) {}

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
     *
     * @throws RuntimeException if the query fails to execute. Callers must not
     *                          treat a caught exception the same as an empty result set -- a prior
     *                          version returned [] for both, which made a broken query on a
     *                          non-configured dialect indistinguishable from a genuinely empty table.
     */
    public function readRows(string $table, int $offset, int $limit): array
    {
        if (! function_exists('odbc_exec') || ! function_exists('odbc_fetch_array')) {
            return [];
        }

        // Table name is validated against a fixed allowlist before this method is called.
        $query = $this->dialect->buildPagedSelect($table, $offset, $limit);
        $result = $this->callOdbc(fn () => odbc_exec($this->connection, $query));
        if ($result === false) {
            throw new RuntimeException(sprintf(
                'ODBC query failed for table "%s": %s',
                $table,
                $this->lastOdbcWarning ?? $this->odbcErrorMessage(),
            ));
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
        $columnSql = implode(', ', array_map($this->dialect->quoteIdentifier(...), $columns));
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));

        return $this->executePrepared(
            sprintf('INSERT INTO %s (%s) VALUES (%s)', $this->dialect->quoteIdentifier($table), $columnSql, $placeholders),
            array_values($values),
        );
    }

    public function updateRow(string $table, string $keyColumn, mixed $keyValue, array $values): int
    {
        $assignments = implode(', ', array_map(
            fn (string $column): string => sprintf('%s = ?', $this->dialect->quoteIdentifier($column)),
            array_keys($values),
        ));

        return $this->executePrepared(
            sprintf(
                'UPDATE %s SET %s WHERE %s = ?',
                $this->dialect->quoteIdentifier($table),
                $assignments,
                $this->dialect->quoteIdentifier($keyColumn),
            ),
            [...array_values($values), $keyValue],
        );
    }

    public function deleteRow(string $table, string $keyColumn, mixed $keyValue): int
    {
        return $this->executePrepared(
            sprintf(
                'DELETE FROM %s WHERE %s = ?',
                $this->dialect->quoteIdentifier($table),
                $this->dialect->quoteIdentifier($keyColumn),
            ),
            [$keyValue],
        );
    }

    /**
     * @param  array<int, mixed>  $params
     */
    private function executePrepared(string $query, array $params): int
    {
        if (! function_exists('odbc_prepare') || ! function_exists('odbc_execute')) {
            return 0;
        }

        $statement = $this->callOdbc(fn () => odbc_prepare($this->connection, $query));
        if ($statement === false) {
            return 0;
        }

        $success = $this->callOdbc(fn () => odbc_execute($statement, $params));
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

    /**
     * Runs an ODBC call without @-suppression: a temporary error handler
     * captures the PHP warning odbc_* functions emit on failure (into
     * $lastOdbcWarning for readRows()'s exception message) instead of
     * silently discarding it, then restores the previous handler either way.
     */
    private function callOdbc(callable $fn): mixed
    {
        $this->lastOdbcWarning = null;
        set_error_handler(function (int $errno, string $errstr): bool {
            $this->lastOdbcWarning = $errstr;

            return true;
        });

        try {
            return $fn();
        } finally {
            restore_error_handler();
        }
    }

    private function odbcErrorMessage(): string
    {
        if (! function_exists('odbc_errormsg')) {
            return 'unknown ODBC error';
        }

        $message = (string) odbc_errormsg($this->connection);

        return $message !== '' ? $message : 'unknown ODBC error';
    }
}
