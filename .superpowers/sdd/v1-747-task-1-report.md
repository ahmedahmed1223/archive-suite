# V1-747 Task 1 — Laravel bulk macro engine

## RED

Created `archive-laravel/tests/Feature/BulkMacrosApiTest.php` first, covering ordered step CRUD, editor/owner controls, non-mutating preview, signed confirmation binding, expiry, stale versions, recoverable delete, partial results, and history.

`node scripts/laravel-docker.mjs test tests/Feature/BulkMacrosApiTest.php` initially failed as expected: all macro create attempts received `404` because the routes and schema did not exist.

## GREEN

Implemented UUID-backed `bulk_macros` and `bulk_macro_runs`, owner-scoped controller/routes, HMAC preview confirmation (15 minutes; user, macro version, and exact ordered targets bound), ordered synthetic preview, execution with per-step results, existing trash semantics, and run history. Added route scope/role fixtures and route-scope documentation.

Final focused verification:

```text
node scripts/laravel-docker.mjs test tests/Feature/BulkMacrosApiTest.php tests/Feature/RouteScopeTest.php
PASS: 12 tests, 84 assertions
```

## Self-review

- Preview only reads `storage_rows`; it neither updates records nor creates trash entries.
- Execution deletes through `TrashController::trashRow()` inside a transaction, preserving recovery behavior.
- Confirmation comparison preserves target order and validates user, macro ID/version, expiry, and HMAC before writes.
- Runs intentionally cascade when their owning macro is deleted, matching the requested foreign-key cleanup; history is therefore available for a macro while that macro is retained.
- OpenAPI and Next.js were intentionally not changed, per Task 1 scope instruction.

## Commit

Pending commit: `feat(macros): add persisted bulk macro engine`.
