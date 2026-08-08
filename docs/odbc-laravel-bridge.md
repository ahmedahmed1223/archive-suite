# Laravel ODBC bridge

[العربية](odbc-laravel-bridge.ar.md) · [Documentation](README.md)

The ODBC bridge provides an authenticated, read-only readiness check for a
configured Windows data source. It reports connection state and a limited list
of table names; it never returns credentials or table contents.

## Requirements

- The PHP ODBC extension in the Laravel runtime.
- A driver that supports the target database.
- A configured DSN or a valid DSN connection string.

## Configuration

```env
ODBC_ENABLED=true
ODBC_DSN=ArchiveSource
ODBC_USERNAME=archive_reader
ODBC_PASSWORD=replace-in-secret-store
ODBC_TABLE_LIMIT=25
```

Keep credentials in a secret store. The API redacts password fields embedded
in a DSN before returning an error.

## Readiness endpoint

`GET /api/v1/system/odbc` requires Archive Suite authentication and returns one
of these states:

- `disabled`: ODBC is disabled.
- `missing-dsn`: `ODBC_DSN` is empty.
- `driver-unavailable`: the PHP extension or driver is unavailable.
- `connected`: the connection succeeded, with table names up to the configured limit.
- `failed`: the connection failed, with a redacted error message.

The supported scope of this endpoint is readiness and schema discovery. It does
not read or write archive records.
