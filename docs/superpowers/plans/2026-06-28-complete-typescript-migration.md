# Complete TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all remaining Archive Suite source implementations and tests to TypeScript/TSX without breaking the current Vite SPA, Node server, shared core exports, or Next.js migration shell.

**Architecture:** Migrate in waves from pure modules to runtime entry points. Keep `.js` compatibility facades only while current imports/package exports require them, then remove facades after a typed build/export strategy exists. Each wave must be independently reviewable, must reduce the JS/JSX count, and must leave `pnpm run typecheck` green.

**Tech Stack:** TypeScript 6, React 19, Vite 8, Next.js 16, Node 22 ESM/tsx, Vitest, Playwright, pnpm workspaces.

---

## Current State

- Current source count after slice 12: 796 JS/JSX and 76 TS/TSX outside generated outputs.
- Progress after slice 13: 785 JS/JSX and 101 TS/TSX outside generated outputs. Tasks 1-3 are complete.
- Progress after slice 14: 778 JS/JSX and 116 TS/TSX outside generated outputs. Tasks 1-4 are complete.
- Progress after Task 10 (2026-06-29): 663 JS/JSX and 773 TS/TSX outside generated outputs. Tasks 1-8 and 10 complete; `archive-app/src` real-JS = 0 (all facades), `archive-server/src` real-JS = 48 (Task 11 surface only). Core facade strategy (Task 9) and server routes/api/adapters/index (Task 11) remain.
- Final verification for slice 13: `pnpm run release:verify` passed after the security baseline fixture was aligned.
- Final verification for slice 14: `pnpm run release:verify` passed with 22 TypeScript migration test files and 216 tests.
- `archive-app/src` is the largest remaining surface: components, pages, stores, adapters, and feature view models.
- `archive-server/src` is the second-largest surface: API routes, storage adapters, auth/config/services, backup/media/export/ingest modules.
- `archive-core/src` has a small number of `.js` compatibility facades that must stay until package exports/build output changes.
- `release:verify` now starts with `pnpm run typecheck`.

## Global Rules For Every Wave

- Rename implementation files only when consumers can keep working through either updated imports or a `.js` re-export facade.
- Convert paired tests with the implementation when the test file is local and behavior-focused.
- Do not convert React entry points (`archive-app/src/main.js`, shell boot files) until the relevant JSX/component wave has already stabilized.
- Do not delete `.js` facades from `archive-core` or package-exported surfaces until Task 9 adds a build/export strategy.
- Do not enable `checkJs` globally. The final state should be TypeScript sources, not a repo-wide JS lint/type cleanup.
- Keep each worker to a disjoint file set. Workers must not edit `TASKS.md`, package scripts, or tsconfig files unless the task explicitly says so.

## Verification Commands

Use these commands as gates:

```powershell
pnpm run typecheck
pnpm --filter @archive/app exec vitest run <changed app test files>
pnpm --filter archive-server test -- <changed server test files>
pnpm --filter @archive/core test -- <changed core test files>
pnpm run release:verify
```

Run focused checks during worker development when practical. The coordinator runs the final comprehensive check.

---

### Task 1: App Pure Feature Models, Batch A

**Files:**
- Convert: `archive-app/src/features/collections/{smartCollectionRules,collectionSources}.js`
- Convert tests: `archive-app/src/features/collections/{smartCollectionRules,collectionSources}.test.js`
- Convert: `archive-app/src/features/errors/{recoveryQueue,errorReportBuilder,errorLogStore}.js`
- Convert tests: `archive-app/src/features/errors/{recoveryQueue,errorReportBuilder,errorLogStore}.test.js`
- Preserve `.js` facades for existing imports.

- [x] **Step 1: Rename implementations and tests to `.ts`**

Use the existing implementation bodies. Add explicit exported interfaces where objects cross module boundaries.

- [x] **Step 2: Add `.js` facades**

Each old implementation path should contain only:

```js
export * from "./moduleName.ts";
```

- [x] **Step 3: Run focused tests**

Run:

```powershell
pnpm --filter @archive/app exec vitest run src/features/collections/smartCollectionRules.test.ts src/features/collections/collectionSources.test.ts src/features/errors/recoveryQueue.test.ts src/features/errors/errorReportBuilder.test.ts src/features/errors/errorLogStore.test.ts
```

Expected: all changed tests pass.

- [x] **Step 4: Run app typecheck**

Run:

```powershell
pnpm run typecheck:app
```

Expected: exit 0.

### Task 2: App Pure Feature Models, Batch B

**Files:**
- Convert: `archive-app/src/features/views/kanbanModel.js`
- Convert test: `archive-app/src/features/views/kanbanModel.test.js`
- Convert: `archive-app/src/features/dnd/dndController.js`
- Convert test: `archive-app/src/features/dnd/dndController.test.js`
- Convert: `archive-app/src/features/timeline/timelineSelectors.js`
- Convert test: `archive-app/src/features/timeline/timelineSelectors.test.js`
- Convert: `archive-app/src/features/dashboard/dashboardLayoutModel.js`
- Convert test: `archive-app/src/features/dashboard/dashboardLayoutModel.test.js`
- Preserve `.js` facades.

- [x] **Step 1: Rename implementations and tests**

Keep behavior unchanged. Type public model shapes and command payloads.

- [x] **Step 2: Add `.js` facades**

Use one-line `export * from "./name.ts";` facades.

- [x] **Step 3: Run focused tests**

Run:

```powershell
pnpm --filter @archive/app exec vitest run src/features/views/kanbanModel.test.ts src/features/dnd/dndController.test.ts src/features/timeline/timelineSelectors.test.ts src/features/dashboard/dashboardLayoutModel.test.ts
```

Expected: all changed tests pass.

- [x] **Step 4: Run app typecheck**

Run `pnpm run typecheck:app`.

### Task 3: App User/Workflow/Activity Pure Modules

**Files:**
- Convert: `archive-app/src/features/workflow/recentDefaults.js`
- Convert test: `archive-app/src/features/workflow/recentDefaults.test.js`
- Convert: `archive-app/src/features/users/{viewModel,permissions}.js`
- Convert test: `archive-app/src/features/users/viewModel.test.js`
- Convert: `archive-app/src/features/activityLog/viewModel.js`
- Convert test: `archive-app/src/features/activityLog/viewModel.test.js`
- Preserve `.js` facades.

- [x] **Step 1: Rename implementations and tests**

Type user roles, permission ids, recent-default payloads, and activity-log rows.

- [x] **Step 2: Keep compatibility facades**

Each old `.js` implementation path re-exports the `.ts` file.

- [x] **Step 3: Run focused tests**

Run:

```powershell
pnpm --filter @archive/app exec vitest run src/features/workflow/recentDefaults.test.ts src/features/users/viewModel.test.ts src/features/activityLog/viewModel.test.ts
```

- [x] **Step 4: Run app typecheck**

Run `pnpm run typecheck:app`.

### Task 4: App Media/Montage Pure Modules

**Files:**
- Convert: `archive-app/src/features/media/{viewModel,scrubberPreview,mediaClient}.js`
- Convert tests where present: `archive-app/src/features/media/{viewModel,scrubberPreview}.test.js`
- Convert: `archive-app/src/features/montage/{waveform,timelineModel,renderGraph,multiTrackModel,filterRegistry}.js`
- Convert tests: matching `.test.js` files.
- Preserve `.js` facades.

- [x] **Step 1: Rename implementations and tests**

Type media item summaries, subtitle/transcript references, waveform points, timeline clips, tracks, render graph nodes, and filter registry entries.

- [x] **Step 2: Add `.js` facades**

Keep current import paths working.

- [x] **Step 3: Run focused tests**

Run:

```powershell
pnpm --filter @archive/app run test src/features/media/viewModel.test.ts src/features/media/scrubberPreview.test.ts src/features/montage/waveform.test.ts src/features/montage/timelineModel.test.ts src/features/montage/renderGraph.test.ts src/features/montage/multiTrackModel.test.ts src/features/montage/filterRegistry.test.ts
```

- [x] **Step 4: Run app typecheck**

Run `pnpm run typecheck:app`.

### Task 5: App Stores And Adapters

**Files:**
- Convert: `archive-app/src/stores/**/*.js`
- Convert tests: `archive-app/src/stores/**/*.test.js`
- Convert: `archive-app/src/storage/adapters/**/*.js`
- Convert storage tests where present.
- Preserve facades for store/adapters imported by non-TypeScript entry points until Task 8.

- [x] **Step 1: Convert store slice files in small groups** — done across slices 21/24-28; all `archive-app/src/stores/**` are now `.ts` with `.js` facades.

- [x] **Step 2: Convert storage adapters by backend** — done; all `archive-app/src/storage/adapters/**/index.js` are facades over `.ts`.

- [x] **Step 3: Run focused tests for changed slices/adapters** — covered by the slice-24-28 full app suite run (143 files / 1245 tests).

- [x] **Step 4: Run app typecheck** — `pnpm run typecheck:app` green as of slice 28. `archive-app/src` real-JS count is 0.

### Task 6: App React Components And Pages

**Files:**
- Convert: `archive-app/src/components/**/*.jsx`
- Convert component tests: `archive-app/src/components/**/*.test.jsx`
- Convert: `archive-app/src/features/**/*.jsx`
- Convert feature component tests.
- Convert: `archive-app/src/pages/**/*.jsx`
- Convert page tests.

- [ ] **Step 1: Convert leaf UI primitives/components first**

Start with `components/ui`, `components/forms`, `components/media`, and `components/offline`.

- [ ] **Step 2: Convert feature components**

Convert feature-local components after their pure view models are typed.

- [ ] **Step 3: Convert pages last**

Pages depend on many feature modules and should move after imports are typed.

- [ ] **Step 4: Run component/page focused tests**

Run changed tests with `pnpm --filter @archive/app exec vitest run ...`.

- [ ] **Step 5: Run app typecheck and SPA builds**

Run:

```powershell
pnpm run typecheck:app
pnpm run build:spa
pnpm run build:cloud
```

### Task 7: App Bootstrap, Services, Hooks, I18n

**Files:**
- Convert: `archive-app/src/bootstrap/**/*.js`
- Convert: `archive-app/src/services/**/*.js`
- Convert: `archive-app/src/hooks/**/*.js`
- Convert: `archive-app/src/i18n/**/*.js`
- Convert related tests.

- [ ] **Step 1: Convert non-React service utilities**

Type API responses, storage schemas, push-service payloads, and i18n locale helpers.

- [ ] **Step 2: Convert hooks after their dependencies are typed**

Use `.ts` for non-JSX hooks and `.tsx` only if JSX is returned.

- [ ] **Step 3: Run focused tests**

Run changed test files.

- [ ] **Step 4: Run app typecheck**

Run `pnpm run typecheck:app`.

### Task 8: App Runtime Entrypoints

**Files:**
- Convert: `archive-app/src/main.js`
- Convert shell/runtime files under `archive-app/src/app/**/*.js`
- Convert any remaining app `.js/.jsx` files not intentionally excluded.

- [ ] **Step 1: Remove obsolete app `.js` facades**

After all imports have moved to typed files or package-local facades are no longer needed, delete app-only facades.

- [ ] **Step 2: Convert entrypoints**

Convert app runtime entrypoints to `.ts`/`.tsx` while preserving Vite behavior.

- [ ] **Step 3: Run app gates**

Run:

```powershell
pnpm run typecheck:app
pnpm run build:spa
pnpm run build:cloud
pnpm --filter @archive/app run verify
```

### Task 9: Core Build/Exports Strategy And Facade Removal

**Files:**
- Modify: `archive-core/package.json`
- Modify/create: `archive-core/tsconfig.build.json` if build output is introduced.
- Convert/remove: remaining `archive-core/src/**/*.js` facades.

> **2026-06-29 finding (attempted + reverted):** Tried Option A (point exports at `.ts`, rewrite core internal specifiers `.js`→`.ts`, delete the 9 facades, add `allowImportingTsExtensions` to core tsconfig). Result: **net-negative, reverted.** Two blockers — (1) `verify-core.mjs` runs under raw `node` and imports `index.js`; (2) consuming packages' `tsc` compiles core's `.ts` files under *their own* tsconfig, so `.ts` import specifiers raise **TS5097** in app/server/next typecheck. Removing facades would force `allowImportingTsExtensions` across every consumer's tsconfig — high blast radius, zero functional gain. The facade pattern + Node v24 type-stripping already makes `@archive/core` a TS-source package consumed cleanly by Vite/tsx/node/vitest. **Decision: keep the 9 `.js` facades as the terminal state.** Only revisit if a real `dist` build (Option B) is needed for external/published consumption.

- [x] **Step 1: Choose runtime strategy** — keep `.ts` sources with thin `.js` re-export facades (current state). Pure-`.ts`/facade-removal evaluated and rejected (see finding above). `dist` build (Option B) deferred until external publishing requires it.

- [ ] **Step 2: Update exports**

Ensure `@archive/core`, `@archive/core/storage`, `@archive/core/ports/*`, and `@archive/core/utils/*` still resolve for app and server.

- [ ] **Step 3: Delete source `.js` facades**

Remove only after exports no longer require them.

- [ ] **Step 4: Run core and workspace gates**

Run:

```powershell
pnpm run verify:core
pnpm run typecheck
```

### Task 10: Server Pure Services

**Files:**
- Convert: server service modules under `archive-server/src/{auth,config,rights,share,export,ingest,backup,media,workflow,retention,files,import,conversion,notifications,recommendations,monitoring,versions}/**/*.js`
- Convert matching tests under `archive-server/src/**/__tests__/*.js`
- Preserve `.js` facades for modules imported by still-JS server entrypoints until Task 11.

- [x] **Step 1: Convert service clusters independently** — done 2026-06-29 via 8 Haiku workers (disjoint write sets): auth, export, ai, media, backup, config+share+rights, mos+ingest, and a misc bucket (logger/cache/conversion/files/monitoring/notifications/retention/versions/webhooks/workflow/etc.). 94 files converted to `.ts` with `.js` facades.

- [x] **Step 2: Convert matching tests** — `auth/__tests__/{authService,tokenService}.test.ts`, `config/__tests__/{env,serverConfig}.test.ts`, `files/__tests__/fileStoreOperations.test.ts`, `workflow/__tests__/dueDateScheduler.test.ts` converted (no test facades). Root `__tests__/*.mjs` integration tests left as-is.

- [x] **Step 3: Run focused server tests** — `pnpm --filter archive-server test`: 21 files / 228 tests pass.

- [x] **Step 4: Run server typecheck** — `pnpm run typecheck:server` → 0 errors; full `pnpm run typecheck` → 0 errors. (173 conversion type errors were cleared by 5 Haiku build-error-resolver workers, mostly by loosening over-strict "normalize arbitrary record" input types; ambient `.d.ts` added for `ws`/`web-push`/`qrcode`/`nodemailer`.)

> Remaining server real-JS after Task 10: 48 files — all Task 11 surface (`api/**`, `routes/**`, `adapters/**`, `index.js`). Server impl count dropped 142 → 48.

### Task 11: Server Routes, API, Adapters, Entrypoint

**Files:**
- Convert: `archive-server/src/api/**/*.js`
- Convert: `archive-server/src/routes/**/*.js`
- Convert: `archive-server/src/adapters/**/*.js`
- Convert: `archive-server/src/index.js`
- Convert remaining server tests.

- [x] **Step 1: Convert adapters before API routes** — done 2026-06-29; all `adapters/**` (cloud-pocketbase/postgres-prisma/sync + files-azure/disk/dropbox/ftp/gdrive/s3/sftp/smb/webdav) converted with `.js` facades.

- [x] **Step 2: Convert API and route files** — `api/**` (server, rpcHandler, searchHandler, handlers, routes/export+rights) and `routes/**` converted; Express-like req/res typed conservatively.

- [x] **Step 3: Convert `src/index.js` last** — `index.ts` created; `index.js` left as facade so the tsx start script is unchanged.

- [x] **Step 4: Run server gates** — `pnpm run typecheck:server` → 0; full `pnpm run typecheck` → 0; `pnpm --filter archive-server test` → 29 files / 287 tests pass.

> Done via 4 Haiku conversion workers + 3 Haiku build-error-resolver workers (120 type errors). Coordinator caught two runtime-class facade defects typecheck does NOT flag — 12 self-referential facades (`export * from "./self.js"`) and 33 invalid `export { default }` re-exports — and deterministically regenerated all 136 server facades from ground truth (default re-export only when the `.ts` actually has a default). Added ambient `.d.ts` for `ssh2-sftp-client`. After Task 11: `archive-server/src` real-impl JS = 0. Only Task 9 (core build/export + facade removal) and Task 12 (final strictness/cleanup) remain.

### Task 12: Final Strictness And Cleanup

**Files:**
- Modify: package `tsconfig.json` files.
- Modify: `TASKS.md`.
- Modify: `docs/superpowers/plans/2026-06-28-complete-typescript-migration.md`.

- [ ] **Step 1: Confirm no source JS/JSX remains except generated/vendor exclusions**

Run:

```powershell
rg --files archive-app/src archive-core/src archive-server/src | rg "\.(js|jsx|mjs)$"
```

Expected: only explicitly documented generated/vendor exceptions, or no output.

- [ ] **Step 2: Tighten includes**

Ensure package `tsconfig.json` files include all source TypeScript and no obsolete JS exceptions.

- [x] **Step 3: Run comprehensive final gate**

Run:

```powershell
pnpm run release:verify
```

Expected: typecheck, verify, SPA/cloud builds, security baseline, and release readiness all pass.

- [x] **Step 4: Update tracker**

Update `TASKS.md` with final counts and verification evidence.

## Low-Cost Agent Dispatch Policy

- Use `gpt-5.4-mini` for pure module conversions with existing tests and 1-8 files.
- Use the default/current model only for cross-package architecture, build/export strategy, or failing verification diagnosis.
- Workers must return: status, files changed, tests run, whether `.js` facades were kept, and any blocked files.
- Coordinator integrates worker changes, resolves conflicts, updates `TASKS.md`, and runs the final comprehensive verification.

## Self-Review

- Spec coverage: covers app, core, server, tests, runtime entrypoints, facades, release gate, and final cleanup.
- Placeholder scan: no TBD/TODO placeholders; tasks name concrete directories/files and commands.
- Type consistency: `.ts` for non-JSX, `.tsx` for JSX, `.js` facades only for compatibility.
