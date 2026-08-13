<?php

declare(strict_types=1);

namespace App\Services\Odbc\Dialect;

class SqlServerDialect implements SqlDialect
{
    public function quoteIdentifier(string $identifier): string
    {
        return '['.str_replace(']', ']]', $identifier).']';
    }

    public function buildPagedSelect(string $table, int $offset, int $limit): string
    {
        // T-SQL requires an ORDER BY for OFFSET/FETCH; (SELECT NULL) keeps the
        // original "no particular order" behavior instead of picking a column.
        return sprintf(
            'SELECT * FROM %s ORDER BY (SELECT NULL) OFFSET %d ROWS FETCH NEXT %d ROWS ONLY',
            $this->quoteIdentifier($table),
            $offset,
            $limit,
        );
    }
}
