<?php

namespace App\Services\Odbc;

interface OdbcConnection
{
    /**
     * @return string[]
     */
    public function tableNames(int $limit): array;

    /**
     * Read rows from a table with offset and limit.
     *
     * @return array<int, array<string, mixed>>
     */
    public function readRows(string $table, int $offset, int $limit): array;
}
