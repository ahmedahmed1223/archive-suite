<?php

return [
    'enabled' => env('ODBC_ENABLED', false),
    'dsn' => env('ODBC_DSN', ''),
    // V2-201: sqlserver|postgresql|mysql. Oracle is explicitly out of scope
    // (see SqlDialectFactory). Default preserves the bridge's original
    // SQL Server-only behavior for existing deployments.
    'dialect' => env('ODBC_DIALECT', 'sqlserver'),
    'username' => env('ODBC_USERNAME'),
    'password' => env('ODBC_PASSWORD'),
    'table_limit' => env('ODBC_TABLE_LIMIT', 25),
];
