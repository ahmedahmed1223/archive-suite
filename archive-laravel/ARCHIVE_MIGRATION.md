# Archive Laravel API Migration

This Laravel application is the parallel API target for Archive Suite. The
current Node server remains the reference implementation until each route group
reaches contract parity.

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
- Audit status: protected mutating API requests are logged to `audit_logs`.
- Rights API status: fetch, upsert, expiring records, and enforcement checks
  are implemented for local parity testing.
- Auth status: `/api/v1/auth/login`, `/auth/me`, `/auth/refresh`, and
  `/auth/logout` use `api_sessions`, short-lived bearer access tokens, and a
  `va_refresh` HttpOnly refresh cookie. `X-Archive-Api-Key` fallback has been
  removed.
- Shared contract source: `../docs/api/archive-contract.openapi.json`.
- Local PHP/Composer are not required yet; tests can run through Docker using
  the Composer image.

## Next Route Groups

1. Build the first Next.js browser auth screen on top of the typed auth client.
2. Move the public share viewer route to Next.js.
3. Queue-backed media workflows and richer audit event taxonomy.

## Verification

From the repository root, when Docker is available:

```powershell
docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test
```
