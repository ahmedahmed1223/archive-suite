<?php

declare(strict_types=1);

namespace App\Services\Odbc\Dialect;

class PostgresDialect implements SqlDialect
{
    public function quoteIdentifier(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }

    public function buildPagedSelect(string $table, int $offset, int $limit): string
    {
        return sprintf(
            'SELECT * FROM %s LIMIT %d OFFSET %d',
            $this->quoteIdentifier($table),
            $limit,
            $offset,
        );
    }
}
