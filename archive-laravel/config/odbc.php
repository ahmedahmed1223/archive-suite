<?php

return [
    'enabled' => env('ODBC_ENABLED', false),
    'dsn' => env('ODBC_DSN', ''),
    'username' => env('ODBC_USERNAME'),
    'password' => env('ODBC_PASSWORD'),
    'table_limit' => env('ODBC_TABLE_LIMIT', 25),
];
