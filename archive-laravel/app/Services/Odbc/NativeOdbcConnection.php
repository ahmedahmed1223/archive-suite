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

        // ponytail: parametrized table name via fixed allowlist in caller; no string concat here.
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
}
