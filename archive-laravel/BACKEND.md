# Laravel backend reference

[العربية](BACKEND.ar.md) · [Documentation](../docs/README.md)

Laravel owns the Archive Suite API, persistence, authentication, permissions,
audit records, and background work. The public contract in
[`docs/api/archive-contract.openapi.json`](../docs/api/archive-contract.openapi.json)
is the source of truth for routes, requests, and responses.

## Development rules

1. Update the OpenAPI contract before changing public API behavior.
2. Implement the behavior in `archive-laravel/` and the client in
   `archive-next/` in the same change.
3. Keep authentication, authorization, validation, and audit logging at the
   Laravel boundary.
4. Run Laravel through the repository Docker helpers; local PHP and Composer
   are optional.

## Safe database changes

The application runs `php artisan archive:migrate-safe` when applying schema
changes. It checks for pending migrations, creates a backup when the database
already contains tables, enters maintenance mode, and applies migrations with
an isolation lock. On failure it remains in maintenance mode and prints the
backup name needed for recovery.

Restore the named backup, bring the application online, correct the migration,
and run the safe migration command again:

```bash
php artisan tinker --execute="app(\App\Services\Backup\BackupService::class)->restore('<backup-name>')"
php artisan up
php artisan archive:migrate-safe
```

## Verification

From the repository root:

```bash
pnpm verify:laravel
pnpm verify:laravel-next:live
```

The first command runs the Laravel test suite. The second verifies the live
Laravel and Next.js integration through the supported application path.
