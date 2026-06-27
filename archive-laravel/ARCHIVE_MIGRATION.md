# Archive Laravel API Migration

This Laravel application is the parallel API target for Archive Suite. The
current Node server remains the reference implementation until each route group
reaches contract parity.

## Current Status

- Laravel scaffold: v13.
- First route groups: `/api/v1/health`, `/api/v1/public/openapi.json`, and
  `/api/v1/rights`.
- First schema group: `storage_rows` and `rights_records`.
- Rights API status: fetch, upsert, expiring records, and enforcement checks
  are implemented for local parity testing.
- Temporary auth status: protected route groups use `ARCHIVE_API_KEY` through
  `X-Archive-Api-Key` or Bearer token until Sanctum/session cookies are added.
- Shared contract source: `../docs/api/archive-contract.openapi.json`.
- Local PHP/Composer are not required yet; tests can run through Docker using
  the Composer image.

## Next Route Groups

1. Replace the temporary API-key guard with HttpOnly cookies or Sanctum.
2. Generic records compatibility over `storage_rows`-style payloads.
3. Search and file browser endpoints.
4. Public share viewer payloads.
5. Queue-backed media and audit workflows.

## Verification

From the repository root, when Docker is available:

```powershell
docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test
```
