<?php

declare(strict_types=1);

namespace App\Services\Odbc\Dialect;

interface SqlDialect
{
    public function quoteIdentifier(string $identifier): string;

    public function buildPagedSelect(string $table, int $offset, int $limit): string;
}
