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
}
