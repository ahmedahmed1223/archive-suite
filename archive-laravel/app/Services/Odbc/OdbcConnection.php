<?php

namespace App\Services\Odbc;

interface OdbcConnection
{
    /**
     * @return string[]
     */
    public function tableNames(int $limit): array;
}
