<?php

namespace App\Services\Odbc;

interface OdbcConnectionFactory
{
    /**
     * @return string[]
     */
    public function availableDrivers(): array;

    public function connect(string $dsn, ?string $username, ?string $password): OdbcConnection;
}
