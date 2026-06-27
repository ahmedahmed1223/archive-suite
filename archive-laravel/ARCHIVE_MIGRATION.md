# Archive Laravel API Migration

This Laravel application is the parallel API target for Archive Suite. The
current Node server remains the reference implementation until each route group
reaches contract parity.

## Current Status

- Laravel scaffold: v13.
- First route group: `/api/v1/health` and `/api/v1/public/openapi.json`.
- First schema group: `storage_rows` and `rights_records`.
- Shared contract source: `../docs/api/archive-contract.openapi.json`.
- Local PHP/Composer are not required yet; tests can run through Docker using
  the Composer image.

## Next Route Groups

1. Auth/session using HttpOnly cookies, then Sanctum/session hardening.
2. Generic records compatibility over `storage_rows`-style payloads.
3. Search and file browser endpoints.
4. Rights records and enforcement status.
5. Public share viewer payloads.

## Verification

From the repository root, when Docker is available:

```powershell
docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test
```
