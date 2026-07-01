<?php

namespace App\Services\Odbc;

use RuntimeException;

class NativeOdbcConnectionFactory implements OdbcConnectionFactory
{
    /**
     * @return string[]
     */
    public function availableDrivers(): array
    {
        if (! function_exists('odbc_drivers')) {
            return [];
        }

        $drivers = odbc_drivers();
        if (! is_array($drivers)) {
            return [];
        }

        $names = [];
        foreach ($drivers as $key => $value) {
            if (is_string($key) && ! is_int($key)) {
                $names[] = $key;
                continue;
            }

            if (is_string($value) && $value !== '') {
                $names[] = $value;
            }
        }

        return array_values(array_unique($names));
    }

    public function connect(string $dsn, ?string $username, ?string $password): OdbcConnection
    {
        if (! function_exists('odbc_connect')) {
            throw new RuntimeException('PHP ODBC extension is not available.');
        }

        $connection = @odbc_connect($dsn, $username ?? '', $password ?? '');
        if ($connection === false) {
            $message = function_exists('odbc_errormsg') ? (string) odbc_errormsg() : 'Unable to connect to ODBC DSN.';

            throw new RuntimeException($message !== '' ? $message : 'Unable to connect to ODBC DSN.');
        }

        return new NativeOdbcConnection($connection);
    }
}
