<?php

declare(strict_types=1);

namespace Tests\Unit\Odbc;

use App\Services\Odbc\Dialect\MySqlDialect;
use App\Services\Odbc\Dialect\PostgresDialect;
use App\Services\Odbc\Dialect\SqlDialectFactory;
use App\Services\Odbc\Dialect\SqlServerDialect;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class SqlDialectFactoryTest extends TestCase
{
    public function test_makes_sqlserver_dialect_by_default_name(): void
    {
        $this->assertInstanceOf(SqlServerDialect::class, SqlDialectFactory::make('sqlserver'));
    }

    public function test_makes_postgresql_dialect(): void
    {
        $this->assertInstanceOf(PostgresDialect::class, SqlDialectFactory::make('PostgreSQL'));
    }

    public function test_makes_mysql_dialect(): void
    {
        $this->assertInstanceOf(MySqlDialect::class, SqlDialectFactory::make('mysql'));
    }

    public function test_rejects_oracle_explicitly(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('explicitly out of scope');

        SqlDialectFactory::make('oracle');
    }

    public function test_rejects_unknown_dialect(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Unsupported ODBC dialect');

        SqlDialectFactory::make('db2');
    }

    public function test_sqlserver_quotes_with_brackets_and_doubles_embedded_bracket(): void
    {
        $dialect = new SqlServerDialect;

        $this->assertSame('[items]', $dialect->quoteIdentifier('items'));
        $this->assertSame('[a]]b]', $dialect->quoteIdentifier('a]b'));
    }

    public function test_sqlserver_paginated_select_requires_order_by(): void
    {
        $query = (new SqlServerDialect)->buildPagedSelect('items', 10, 25);

        $this->assertSame(
            'SELECT * FROM [items] ORDER BY (SELECT NULL) OFFSET 10 ROWS FETCH NEXT 25 ROWS ONLY',
            $query,
        );
    }

    public function test_postgres_quotes_with_double_quotes(): void
    {
        $dialect = new PostgresDialect;

        $this->assertSame('"items"', $dialect->quoteIdentifier('items'));
        $this->assertSame('"a""b"', $dialect->quoteIdentifier('a"b'));
    }

    public function test_postgres_paginated_select_uses_limit_offset(): void
    {
        $query = (new PostgresDialect)->buildPagedSelect('items', 10, 25);

        $this->assertSame('SELECT * FROM "items" LIMIT 25 OFFSET 10', $query);
    }

    public function test_mysql_quotes_with_backticks(): void
    {
        $dialect = new MySqlDialect;

        $this->assertSame('`items`', $dialect->quoteIdentifier('items'));
        $this->assertSame('`a``b`', $dialect->quoteIdentifier('a`b'));
    }

    public function test_mysql_paginated_select_uses_limit_offset(): void
    {
        $query = (new MySqlDialect)->buildPagedSelect('items', 10, 25);

        $this->assertSame('SELECT * FROM `items` LIMIT 25 OFFSET 10', $query);
    }
}
