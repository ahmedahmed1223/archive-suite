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
  are implemented for local parity testing. Authentication hardening is still
  pending before production exposure.
- Shared contract source: `../docs/api/archive-contract.openapi.json`.
- Local PHP/Composer are not required yet; tests can run through Docker using
  the Composer image.

## Next Route Groups

1. Auth/session using HttpOnly cookies, then Sanctum/session hardening.
2. Generic records compatibility over `storage_rows`-style payloads.
3. Search and file browser endpoints.
4. Public share viewer payloads.
5. Queue-backed media and audit workflows.

## Verification

From the repository root, when Docker is available:

```powershell
docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test
```
