# Laravel ODBC bridge

[العربية](odbc-laravel-bridge.md) · [Documentation](README.md)

The ODBC bridge is a guarded readiness and read path for legacy Windows data
sources within the supported Laravel + Next.js product. It requires the PHP
ODBC extension, an installed driver, and a preconfigured DSN or valid
connection string. It is administered as part of the organisation's protected
Windows data-source configuration.

Keep credentials in protected environment configuration. Run the readiness
check before querying tables, use least-privilege database credentials, and do
not expose legacy connection details in support bundles or public issues.
