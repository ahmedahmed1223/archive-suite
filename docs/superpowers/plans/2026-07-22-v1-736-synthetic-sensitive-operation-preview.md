# V1-736 Synthetic Sensitive-Operation Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated Arabic simulation environment where bulk-delete and trash-restore behavior can be exercised on deterministic synthetic data without touching production persistence.

**Architecture:** A pure Laravel domain service owns deterministic scenarios and mutation rules in memory; a thin controller authorizes and validates requests. OpenAPI defines the public envelope, the Next client consumes generated-compatible types, and a dedicated App Router page renders the simulation workflow without calling production mutation endpoints.

**Tech Stack:** Laravel/PHP 8, Next.js App Router/React 19/TypeScript, OpenAPI JSON, PHPUnit, Vitest/Testing Library, Playwright.

## Global Constraints

- Work only in canonical `archive-laravel/`, `archive-next/`, and `docs/api/` paths.
- Simulation must never query or mutate `storage_rows`, `trashed_records`, media storage, queues, audit logs, or external services.
- All simulation payloads and results must carry `synthetic: true`; the Arabic UI must state that production data was not touched.
- Only authenticated editors and administrators may list or execute scenarios; viewers receive `403`.
- Use deterministic scenario identifiers `bulk-delete-basic` and `restore-conflict`.
- Public-contract changes must update OpenAPI, Laravel, the handwritten Next client, generated bindings, and contract checks together.
- Begin each behavior change with a failing focused test and preserve all unrelated worktree edits.

---

### Task 1: Pure synthetic preview engine and authenticated Laravel API

**Files:**
- Create: `archive-laravel/app/Services/SafetyPreview/SafetyPreviewService.php`
- Create: `archive-laravel/app/Http/Controllers/Api/V1/SafetyPreviewController.php`
- Create: `archive-laravel/tests/Feature/SafetyPreviewApiTest.php`
- Modify: `archive-laravel/routes/api.php`

**Interfaces:**
- Produces: `SafetyPreviewService::scenarios(): array` and `SafetyPreviewService::run(string $scenario, string $operation, array $ids): array`.
- Produces: `GET /api/v1/safety-preview/scenarios` and `POST /api/v1/safety-preview/run`.
- Response fields: `synthetic`, `scenario`, `operation`, `expiresAt`, `before.live`, `before.trash`, `after.live`, `after.trash`, `results`.

- [ ] **Step 1: Write the failing feature tests**

Add tests that assert editor access, viewer denial, fixed scenario IDs, de-duplication, missing-item outcomes, restore conflict outcomes, ISO-8601 expiry, and unchanged counts/content for `storage_rows` and `trashed_records` before and after every preview run.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node scripts/laravel-docker.mjs test tests/Feature/SafetyPreviewApiTest.php`

Expected: FAIL because routes/controller/service do not exist.

- [ ] **Step 3: Implement the pure service and controller**

Represent scenario state with local PHP arrays keyed by UID. `bulk-delete-basic` starts with three live synthetic items and empty trash. `restore-conflict` starts with one live item and two trash items, one sharing the live UID. For delete, move matching live items into the local trash array. For restore, return `reason: conflict` when the UID is live and `reason: not_found` when absent; otherwise move the trash item into live. Generate `expiresAt` as the response-generation time plus 15 minutes. Validate scenario with `Rule::in`, operation with `delete|restore`, and IDs as a unique string array of 1..10000 entries. Authorize through the existing editor guard.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node scripts/laravel-docker.mjs test tests/Feature/SafetyPreviewApiTest.php`

Expected: all tests pass and database non-mutation assertions remain green.

- [ ] **Step 5: Commit Task 1**

Stage only the four Task 1 files and commit `feat(safety): add synthetic operation preview API`.

### Task 2: OpenAPI contract and typed Next client

**Files:**
- Modify: `docs/api/archive-contract.openapi.json`
- Modify: `archive-next/lib/generated/archive-api.ts`
- Modify: `archive-next/lib/archive-api.ts`
- Modify: contract/generated checks selected by `pnpm verify:api-contracts` and `pnpm verify:api-generated` only if their snapshots require it.

**Interfaces:**
- Consumes: Task 1 endpoints and response fields.
- Produces: `SafetyPreviewScenario`, `SafetyPreviewOperation`, `SafetyPreviewRun`, `safetyPreviewScenarios()`, and `runSafetyPreview(payload)` in the handwritten client.

- [ ] **Step 1: Add failing contract/client assertions**

Assert both paths, editor authorization responses, request enum values, required `synthetic: true`, scenario/operation enums, before/after count objects, result status/reason, and expiry format. Add a focused client test proving neither method targets `/records/bulk-delete` nor `/trash/restore`.

- [ ] **Step 2: Verify RED**

Run: `pnpm verify:api-contracts && pnpm verify:api-generated`

Expected: FAIL until the OpenAPI paths and generated binding exist.

- [ ] **Step 3: Update OpenAPI, regenerate, and wire the client**

Define the two paths and reusable schemas, run the repository's existing generation command surfaced by `verify:api-generated`, and add handwritten client types/methods that call only `/safety-preview/scenarios` and `/safety-preview/run`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm verify:api-contracts; pnpm verify:api-generated; pnpm typecheck`

Expected: all commands pass.

- [ ] **Step 5: Commit Task 2**

Stage only Task 2 contract/client files and commit `feat(api): contract synthetic safety previews`.

### Task 3: Arabic safety-preview workflow

**Files:**
- Create: `archive-next/app/safety-preview/page.tsx`
- Create: `archive-next/app/safety-preview/page.test.tsx`
- Create: `archive-next/e2e/safety-preview.spec.ts`
- Modify: the existing canonical navigation registry used by `AppShell`.

**Interfaces:**
- Consumes: Task 2 `safetyPreviewScenarios()` and `runSafetyPreview(payload)`.
- Produces: role-aware `/safety-preview` page with scenario/operation controls and response visualization.

- [ ] **Step 1: Write failing UI and Playwright tests**

Mock the two preview endpoints. Assert Arabic synthetic-data warning, no production endpoint requests, editor controls, viewer-safe denial state, before/after live/trash counts, conflict/not-found labels, per-item results, and an expiry display.

- [ ] **Step 2: Verify RED**

Run the focused Vitest command used by `archive-next/package.json` for `app/safety-preview/page.test.tsx`.

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the page and navigation entry**

Use `AppShell`, `PageToolbar`, `OperationalSafetyPanel`, and existing metric/table styles. Label the page and action as a simulation, display `synthetic: true` evidence in Arabic, disable execution while loading, preserve accessible labels/live status, and render API errors without falling back to production endpoints.

- [ ] **Step 4: Verify GREEN**

Run: focused Vitest; `pnpm typecheck`; the focused Playwright spec against the repository's supported test setup.

Expected: all focused checks pass.

- [ ] **Step 5: Commit Task 3**

Stage only Task 3 files and commit `feat(next): add synthetic safety preview workspace`.

### Task 4: Cross-layer verification and task closure

**Files:**
- Modify: `TASKS.md`
- Modify: `docs/superpowers/plans/2026-07-22-v1-736-synthetic-sensitive-operation-preview.md`

**Interfaces:**
- Consumes: all Task 1–3 commits and independent task reviews.
- Produces: verified V1-736 completion evidence and corrected remaining-task count.

- [ ] **Step 1: Run complete V1-736 gates**

Run: `pnpm verify:api-contracts`; `pnpm verify:api-generated`; `pnpm typecheck`; `pnpm test:next`; `pnpm build:next`; focused Laravel preview tests; focused Playwright preview test.

Expected: every command passes; only documented pre-existing warnings may remain.

- [ ] **Step 2: Perform independent whole-change review**

Review contract fidelity, authorization, persistence isolation, Arabic UX, accessibility, and test evidence. Fix and re-review all Critical/Important findings.

- [ ] **Step 3: Close V1-736 and recalculate the task count**

Change only the V1-736 checkbox after all evidence passes. Count unchecked task entries mechanically and update the declaration to the exact value.

- [ ] **Step 4: Commit closure evidence**

Stage only `TASKS.md` and this plan, then commit `docs: close synthetic safety preview task`.

