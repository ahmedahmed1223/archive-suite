<?php

declare(strict_types=1);

namespace App\Services\Odbc\Dialect;

use InvalidArgumentException;

class SqlDialectFactory
{
    /**
     * @var array<string, class-string<SqlDialect>>
     */
    private const SUPPORTED = [
        'sqlserver' => SqlServerDialect::class,
        'postgresql' => PostgresDialect::class,
        'mysql' => MySqlDialect::class,
    ];

    public static function make(string $name): SqlDialect
    {
        $key = strtolower(trim($name));

        if ($key === 'oracle') {
            throw new InvalidArgumentException(
                'ODBC dialect "oracle" is explicitly out of scope (TASKS.md V2-201). '.
                'Supported dialects: '.implode(', ', array_keys(self::SUPPORTED)).'.'
            );
        }

        $class = self::SUPPORTED[$key] ?? null;
        if ($class === null) {
            throw new InvalidArgumentException(sprintf(
                'Unsupported ODBC dialect "%s". Supported dialects: %s.',
                $name,
                implode(', ', array_keys(self::SUPPORTED)),
            ));
        }

        return new $class;
    }
}
