<?php

namespace App\Services\Odbc;

use App\Services\Odbc\Dialect\SqlDialectFactory;
use RuntimeException;

class NativeOdbcConnectionFactory implements OdbcConnectionFactory
{
    public function __construct(private readonly string $dialect = 'sqlserver') {}

    /**
     * @return string[]
     */
    public function availableDrivers(): array
    {
        // PHP's odbc extension has never shipped an odbc_drivers() function --
        // it exposes odbc_connect/odbc_data_source/odbc_tables and no driver
        // enumeration at all. Gating on it left this method returning [] in
        // every environment that has ever run, so OdbcConnectionProbe always
        // reported driverLoaded=false / "driver-unavailable" and every
        // contracted /api/v1/system/odbc* route was dead even with the
        // extension, a registered psqlODBC driver and a working DSN present.
        //
        // The capability that actually matters is the connect function. A
        // missing or broken driver still surfaces, as a connection error from
        // odbc_connect(), which probe() already catches and reports.
        if (! function_exists('odbc_connect')) {
            return [];
        }

        return ['odbc'];
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

        return new NativeOdbcConnection($connection, SqlDialectFactory::make($this->dialect));
    }
}
