# V1-301A Onboarding Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the organisation-wide onboarding milestones in Laravel so every signed-in user sees the same truthful progress and only administrators can update it.

**Architecture:** A small `OnboardingProgressService` stores one durable JSON document in the existing `storage_rows` key-value table. A focused controller exposes authenticated read access and admin-only stage updates. The OpenAPI contract and Next client mirror the same five fixed stages; UI wiring is deliberately deferred to V1-301B.

**Tech Stack:** Laravel 13/PHP, PHPUnit, OpenAPI JSON, Next.js/TypeScript.

## Global Constraints

- Scope is one organisation/workspace, not per user.
- Stages are exactly `organization`, `storage`, `invitation`, `first_record`, and `first_search`.
- Each returned stage has `status` (`pending` or `completed`) and `completedAt` (ISO-8601 timestamp or `null`).
- Any authenticated role may read; only `admin` may update.
- Updating a stage to `completed` assigns the server timestamp; resetting to `pending` clears it.
- No first-run UI change belongs in V1-301A.

---

### Task 1: Red API-contract tests

**Files:**
- Create: `archive-laravel/tests/Feature/OnboardingProgressApiTest.php`
- Modify: `archive-laravel/tests/Feature/RouteScopeTest.php`

**Interfaces:** Produces the behavioural contract for `GET /api/v1/onboarding/progress` and `PATCH /api/v1/onboarding/progress/{stage}`.

- [x] Add a `RefreshDatabase` feature test with authenticated admin, editor, and viewer helpers.
- [x] Assert the initial GET returns five ordered pending stages with `completedAt: null`; assert an admin update returns a completed stage with a timestamp and that a later GET persists it.
- [x] Assert viewers can GET but receive 403 for PATCH; assert unknown stages and invalid statuses receive 422, and unauthenticated GET receives 401.
- [x] Add both routes to RouteScope fixtures with V1 scope and role expectations (`any` for GET, `admin` for PATCH).
- [x] Run `node scripts/laravel-docker.mjs test --filter=OnboardingProgressApiTest`; confirmed RED with 404 before implementation.

### Task 2: Minimal durable Laravel API

**Files:**
- Create: `archive-laravel/app/Services/Onboarding/OnboardingProgressService.php`
- Create: `archive-laravel/app/Http/Controllers/Api/V1/OnboardingProgressController.php`
- Modify: `archive-laravel/routes/api.php`

**Interfaces:** `OnboardingProgressService::progress(): array` returns `{stages: list<array{id,status,completedAt}>}`. `update(string $stage, string $status): array` validates the fixed stage/status vocabulary and persists the changed state.

- [x] Implement the service against `StorageRow` using store and uid `onboarding-progress`, returning defaults when no row exists and preserving the fixed stage order.
- [x] Implement `index(Request $request)` and `update(Request $request, string $stage)`; call `requireAdmin` only from `update` and validate `status` with `Rule::in(['pending', 'completed'])`.
- [x] Register the controller routes inside the existing `archive.auth` API group.
- [x] Run the focused test again; all assertions pass.

### Task 3: Shared contract and typed client

**Files:**
- Modify: `docs/api/archive-contract.openapi.json`
- Modify: `archive-next/lib/archive-api.ts`

**Interfaces:** Adds `OnboardingProgress`, `OnboardingStage`, and `UpdateOnboardingStagePayload`, plus `archiveApi.onboardingProgress()` and `archiveApi.updateOnboardingStage(stage, payload)`.

- [x] Extend OpenAPI paths and components with both endpoints, auth requirements, admin-only PATCH description, fixed stage enum, status enum, and timestamp/null shape.
- [x] Add matching exported TypeScript types and typed client methods using the existing `get`/`patch` helpers.
- [x] Run `pnpm verify:api-contracts` and `pnpm typecheck`; both succeed.

### Task 4: Batch verification and task record

**Files:**
- Modify: `TASKS.md`
- Modify: `ChangeLog.md`

- [x] Run `git diff --check`, the focused Laravel test, RouteScopeTest, API-contract verification, typecheck, and `pnpm build:next`.
- [x] Mark V1-301A complete with the exact verification evidence and add a concise ChangeLog entry; do not mark V1-301B or V1-301C complete.
- [ ] Commit only V1-301A files as `feat(onboarding): persist organisation progress` after the worktree owner has separated unrelated changes.
