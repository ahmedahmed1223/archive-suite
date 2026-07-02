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

    /**
     * Insert one row into an allowlisted table.
     *
     * @param  array<string, mixed>  $values
     */
    public function insertRow(string $table, array $values): int;

    /**
     * Update one or more rows matched by a key column.
     *
     * @param  array<string, mixed>  $values
     */
    public function updateRow(string $table, string $keyColumn, mixed $keyValue, array $values): int;

    /**
     * Delete one or more rows matched by a key column.
     */
    public function deleteRow(string $table, string $keyColumn, mixed $keyValue): int;
}
