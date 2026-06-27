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
- Temporary auth status: protected route groups use `ARCHIVE_API_KEY` through
  `X-Archive-Api-Key` or Bearer token until Sanctum/session cookies are added.
- Shared contract source: `../docs/api/archive-contract.openapi.json`.
- Local PHP/Composer are not required yet; tests can run through Docker using
  the Composer image.

## Next Route Groups

1. Replace the temporary API-key guard with HttpOnly cookies or Sanctum.
2. Queue-backed media workflows and richer audit event taxonomy.

## Verification

From the repository root, when Docker is available:

```powershell
docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test
```
