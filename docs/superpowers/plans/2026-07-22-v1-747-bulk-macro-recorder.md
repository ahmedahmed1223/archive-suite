# V1-747 Bulk Macro Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist, preview, and execute reusable ordered bulk-action macros against an explicit archive selection with mandatory signed preview confirmation.

**Architecture:** Laravel owns macro definitions, preview calculation, signed confirmation, execution, and history. OpenAPI and the generated/handwritten Next client expose exact types. The archive selection toolbar provides an Arabic recorder and enforces preview-before-run in the UI while Laravel remains authoritative.

**Tech Stack:** Laravel/PHP 8, database migrations, Next.js App Router/React 19/TypeScript, OpenAPI, PHPUnit, Vitest, Playwright.

## Global Constraints

- Canonical paths only: `archive-laravel/`, `archive-next/`, and `docs/api/`.
- Macro owners are authenticated editors/admins; viewers receive `403`; users cannot access another user's macros or runs.
- Steps are ordered, 1..10, and limited to `add-tag`, `set-workflow-status`, and recoverable `delete`.
- Targets are unique `{store,id}` pairs, 1..1000.
- Preview never mutates records/trash or creates a run record.
- Run requires a 15-minute signed token binding user, macro ID/version, and exact ordered targets.
- Partial execution is reported per target/step; no rollback claim.
- Public changes update Laravel, OpenAPI, generated and handwritten clients, and contract tests together.
- TDD first; preserve unrelated commits/files; one comprehensive review after all three tasks.

---

### Task 1: Laravel macro domain, persistence, preview, and execution

**Files:**
- Create migration tables `bulk_macros` and `bulk_macro_runs` with UUID IDs, owner, version, JSON steps/results, counts, timestamps, and foreign-key cleanup.
- Create focused model/service/controller files under `archive-laravel/app/`.
- Modify `archive-laravel/routes/api.php`, `archive-laravel/tests/Feature/RouteScopeTest.php`, and `docs/scope/v1-route-scope.md`.
- Create `archive-laravel/tests/Feature/BulkMacrosApiTest.php`.

**Interfaces:**
- Produces CRUD routes under `/api/v1/bulk-macros` plus `/{id}/preview`, `/{id}/run`, and `/{id}/runs`.
- Preview produces `previewToken`, `expiresAt`, summary, and per-target ordered step outcomes.
- Run consumes `targets` plus `previewToken` and produces persisted run/result data.

- [ ] Write failing tests for roles/ownership, CRUD validation, step order, preview non-mutation, token mismatch/expiry/stale version, tag/status writes, recoverable delete, partial results, and history.
- [ ] Run focused Docker PHPUnit and confirm failures are caused by absent schema/routes.
- [ ] Implement migration, focused value/service classes, controller, routes, scope fixtures, and route documentation.
- [ ] Run `BulkMacrosApiTest.php` and `RouteScopeTest.php` to green; run migration refresh through the tests.
- [ ] Commit only Task 1 files as `feat(macros): add persisted bulk macro engine` and write `.superpowers/sdd/v1-747-task-1-report.md`.

### Task 2: OpenAPI and typed Next client

**Files:**
- Modify `docs/api/archive-contract.openapi.json`, `scripts/verify-api-contracts.mjs`, `archive-next/lib/generated/archive-api.ts`, `archive-next/lib/archive-api.ts`, and focused client tests.

**Interfaces:**
- Consumes Task 1 route/envelope shapes.
- Produces `BulkMacro`, `BulkMacroStep`, `BulkMacroTarget`, `BulkMacroPreview`, `BulkMacroRun` and typed CRUD/preview/run/history methods.

- [ ] Add failing contract/client assertions for every route, enum, bound, required field, role/error response, and exact path.
- [ ] Run contract/generated/focused client checks and confirm RED.
- [ ] Update OpenAPI, regenerate bindings, and wire only the new typed client methods.
- [ ] Run `pnpm verify:api-contracts`, `pnpm verify:api-generated`, focused client tests, and `pnpm typecheck` to green.
- [ ] Commit only Task 2 files as `feat(api): contract bulk macro recorder` and write `.superpowers/sdd/v1-747-task-2-report.md`.

### Task 3: Archive macro recorder and mandatory preview UI

**Files:**
- Create focused recorder components/helpers/tests under `archive-next/app/archive/_components/` and `archive-next/lib/`.
- Modify `archive-next/app/archive/page.tsx` only for selection/recorder wiring.
- Create `archive-next/e2e/bulk-macro-recorder.spec.ts`.

**Interfaces:**
- Consumes Task 2 macro client methods and current `selectedIds`/record store data.
- Produces recording, step order editing, save/list, preview, execution, expiry/error, and history-result UI.

- [ ] Write failing Vitest and Playwright tests for recording steps, reorder/remove, save, selection targets, no-run-before-preview, altered selection invalidation, preview details, execution, and Arabic accessible feedback.
- [ ] Run focused tests and confirm RED from absent recorder behavior.
- [ ] Implement focused helpers/components and minimal archive-page wiring with no production endpoint fallback.
- [ ] Run focused Vitest, `pnpm typecheck`, and focused Playwright with a supported server to green.
- [ ] Commit only Task 3 files as `feat(next): add bulk macro recorder` and write `.superpowers/sdd/v1-747-task-3-report.md`.

### Task 4: Full verification, one review, and closure

- [ ] Run contract/generated/typecheck, full Next tests/build, focused Laravel macro/route suites, and Chromium/mobile Playwright.
- [ ] Generate bounded diff packages and dispatch one comprehensive reviewer across all layers.
- [ ] Fix all Critical/Important findings in one pass and re-review with the same reviewer.
- [ ] Remove V1-747 from `TASKS.md`, recalculate the exact open count, archive evidence in `ChangeLog.md`, and commit `docs: close bulk macro recorder task`.
