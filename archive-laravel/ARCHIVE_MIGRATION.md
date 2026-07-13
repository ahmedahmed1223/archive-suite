# Archive Laravel API Migration

This Laravel application is the canonical API target for Archive Suite. The
legacy Node server remains available as a reference/fallback only while the last
unmatched operational edges are retired.

## Current Status

- Laravel scaffold: v13.
- First route groups: `/api/v1/health`, `/api/v1/public/openapi.json`,
  `/api/v1/records`, `/api/v1/records/bulk`, and `/api/v1/rights`.
- First schema group: `storage_rows` and `rights_records`.
- Records API status: bulk upsert and cursor-based listing are implemented for
  migration compatibility over flexible `ArchiveRecord` payloads.
- Search API status: keyword search over `storage_rows` is implemented with
  store filtering and cursor pagination; semantic search is not implemented yet.
- Files API status: local file listing and browser endpoints are implemented
  over `ARCHIVE_FILE_ROOT` with path traversal protection.
- Share API status: protected share creation and public token payload reads are
  implemented with `share_links` and `storage_rows` lookups.
- Audit status: protected mutating API requests are logged to `audit_logs` with
  searchable event taxonomy, resource identity, actor, and outcome fields.
- Media workflow status: `/api/v1/media/jobs` queues tracked jobs in
  `media_jobs`; `ProcessMediaWorkflow` marks placeholder thumbnail/transcode/
  transcription work through queued lifecycle states.
- Rights API status: fetch, upsert, expiring records, and enforcement checks
  are implemented for local parity testing.
- Auth status: `/api/v1/auth/login`, `/auth/me`, `/auth/refresh`, and
  `/auth/logout` use `api_sessions`, short-lived bearer access tokens, and a
  `va_refresh` HttpOnly refresh cookie. `X-Archive-Api-Key` fallback has been
  removed.
- Next integration status: `NextIntegrationSeeder` provides stable auth,
  records, share, and media fixtures for `pnpm run verify:laravel-next:live`
  through the Next.js API rewrite.
- Shared contract source: `../docs/api/archive-contract.openapi.json`.
- Local PHP/Composer are not required; root scripts run Laravel tests and dev
  serve through Docker using the Composer image.

## Development Rules

1. New API work starts in Laravel and updates the shared OpenAPI contract first.
2. New UI work starts in `archive-next`; do not add net-new Vite/Node routes.
3. Keep Node-only behavior as a parity reference until it is either ported or
   explicitly retired.

## Verification

From the repository root, when Docker is available:

```powershell
pnpm verify:laravel
```

For the Next.js plus Laravel route-level smoke, seed a temporary SQLite database
with `Database\Seeders\NextIntegrationSeeder`, run Laravel and Next.js, then run:

```powershell
pnpm run verify:laravel-next:live
```

## Migration safety (V1-203)

The `laravel` compose service (both `infra/docker-compose.yml` and
`infra/docker-compose.laravel-next.yml`) runs
`php artisan archive:migrate-safe` on every container start instead of a raw
`migrate --force`. `scripts/control-center.mjs migrate` calls the same
command. Source: `app/Console/Commands/MigrateSafe.php`.

What it does, in order:

1. **Preflight** — checks `migrate:status`-equivalent pending-migration list.
   If nothing is pending, exits `0` immediately: no backup, no downtime.
2. **Backup** — takes a full snapshot via `BackupService` before touching the
   schema, unless `--skip-backup` is passed or the database has no tables yet
   (first boot on an empty volume auto-skips and logs why).
3. **Maintenance** — only once pending migrations are confirmed, runs
   `php artisan down` (optionally with `ARCHIVE_MIGRATION_SECRET` as the
   bypass secret).
4. **Migrate-once** — runs `migrate --force --isolated` so two containers
   starting concurrently can't both apply migrations. Falls back to a plain
   `--force` run with a warning if the active cache store doesn't support
   atomic locks (only `file`/`null` cache stores lack this; the default
   `redis`/`database`/`array` stores all support it).
5. **Recovery** — on success, runs `php artisan up` and the app comes back
   online. On failure, the app is **left in maintenance mode** on purpose
   (rolling forward on a half-migrated schema is worse than a visible
   maintenance page) and the command prints the exact rollback command.

### Rollback

If `archive:migrate-safe` fails, it prints the backup name it took right
before the failure. To roll back:

```bash
php artisan tinker --execute="app(\App\Services\Backup\BackupService::class)->restore('<backup-name>')"
php artisan up
```

Then fix the migration and re-run `archive:migrate-safe` (or redeploy).
