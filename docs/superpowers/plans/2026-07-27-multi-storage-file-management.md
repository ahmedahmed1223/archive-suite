# Multi-Storage File Management Implementation Plan

> **For agentic workers:** Execute the three independent implementation tracks in parallel; the coordinator exclusively owns OpenAPI, generated bindings, merge commits, and final verification.

**Goal:** Add safe, role-aware management of files across all configured storage providers.

**Architecture:** Laravel owns a provider-agnostic storage catalog, adapters, operation state, checksums, audit, and authorization. Next.js consumes a stable API for choosing a storage provider, browsing folders, and starting observable operations. Existing Dropbox routes remain compatible adapters during migration.

**Tech Stack:** Laravel, Flysystem, Next.js/React, OpenAPI, Vitest, Playwright, PostgreSQL.

## Global Constraints

- New public API changes are merged only by the coordinator in `docs/api/archive-contract.openapi.json` and generated Next bindings.
- Laravel retains all provider credentials and operational state; UI never receives secrets.
- Destructive or bulk operations require a signed preview token and return per-item outcomes.
- All providers support capability discovery; unsupported actions are absent from the UI and rejected server-side.
- Existing record-trash behavior is never repurposed for raw object deletion.

### Task 1: Provider catalog and operation engine

**Files:**
- Create: `archive-laravel/app/Services/Storage/StorageCatalog.php`, `StorageOperationService.php`, `StorageOperation.php`
- Create: migrations for `storage_operations` and `storage_operation_items`
- Modify: Laravel routes and provider adapters
- Test: `archive-laravel/tests/Feature/StorageOperationsTest.php`

- [ ] Write a failing test that a catalog entry omits secrets and exposes only its capabilities.
- [ ] Implement catalog entries `{id,type,label,capabilities,status}` for local, S3, and Dropbox.
- [ ] Write failing tests for preview, checksum conflict, cancel, and resumable operation state.
- [ ] Implement signed preview and idempotent operation records with per-item result states.
- [ ] Commit backend-only changes.

### Task 2: Files workspace UI

**Files:**
- Modify: `archive-next/app/files/page.tsx`
- Create: `archive-next/components/StorageBrowser.tsx`, `StorageOperationPanel.tsx`
- Test: `archive-next/components/StorageBrowser.test.tsx`, `archive-next/e2e/storage-files.authed.spec.ts`

- [ ] Write a failing component test for provider selection and capability-gated actions.
- [ ] Implement provider selector, breadcrumb browser, search/filter, safe preview/download, and transfer status surface.
- [ ] Write a failing interaction test for preview-confirm-cancel flow.
- [ ] Implement disabled unsupported actions and Arabic conflict/quota/retry states.
- [ ] Commit Next-only changes without generated bindings.

### Task 3: Provider adapters and transfer semantics

**Files:**
- Modify: `archive-laravel/app/Services/Dropbox/DropboxGateway.php` and storage adapters
- Create: `archive-laravel/app/Services/Storage/StreamTransfer.php`
- Test: `archive-laravel/tests/Unit/Storage/StreamTransferTest.php`

- [ ] Write failing stream tests for resume offset, SHA-256 verification, and cancel between chunks.
- [ ] Implement bounded streaming copy between two adapters with retry and conflict policies `skip`, `copy`, and confirmed `replace`.
- [ ] Write failing adapter tests for folder traversal confinement and redacted audit payloads.
- [ ] Implement folder browsing and audited create/rename/delete/copy/move semantics where capabilities permit.
- [ ] Commit adapter-only changes.

### Task 4: Coordinator contract integration and verification

**Files:**
- Modify: `docs/api/archive-contract.openapi.json`, `archive-next/lib/archive-api.ts`, generated bindings, `TASKS.md`, `ChangeLog.md`

- [ ] Merge the three tracks into additive OpenAPI schemas and endpoints.
- [ ] Regenerate bindings and resolve all shared-file conflicts.
- [ ] Run contract checks, targeted Laravel/Next tests, then `pnpm verify` once after the complete batch.
- [ ] Update task records only with evidence; document external live-provider requirements separately.
