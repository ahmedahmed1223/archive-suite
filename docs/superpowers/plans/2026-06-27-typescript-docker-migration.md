# TypeScript Docker Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue the full TypeScript migration without breaking the Docker deployment path.

**Architecture:** Keep the app runnable while converting leaf modules first. Docker verification is a gate for each migration slice because the production images build from the monorepo and can fail for missing manifests, ignored files, or required environment variables.

**Tech Stack:** pnpm workspaces, Vite, React, Next.js, Laravel, Node/tsx, Docker Compose, TypeScript.

---

### Task 1: Repair Docker Compose Verification Inputs

**Files:**
- Modify: `archive-server/.env.example`
- Verify: `pnpm run docker:config:postgres`

- [x] **Step 1: Reproduce the failure**

Run: `pnpm run docker:config:postgres`
Expected before fix: FAIL because `PGADMIN_EMAIL` is missing.

- [x] **Step 2: Add all required compose variables to `.env.example`**

Add non-secret placeholder values for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `PGADMIN_EMAIL`, `PGADMIN_PASSWORD`, and `GRAFANA_PASSWORD`.

- [x] **Step 3: Verify the config**

Run: `pnpm run docker:config:postgres`
Expected after fix: PASS and print normalized compose config.

- [x] **Step 4: Verify dev Docker still runs**

Run: `docker compose --env-file archive-server/.env.example -f archive-server/docker-compose.yml -f archive-server/docker-compose.dev.yml up -d --build`
Expected: frontend and PocketBase containers start; `http://127.0.0.1:8080/` returns 200.

### Task 2: Convert Low-Risk Core Utilities to TypeScript

**Files:**
- Rename/modify: `archive-core/src/utils/arabicNormalize.js` -> `archive-core/src/utils/arabicNormalize.ts`
- Rename/modify test: `archive-core/src/__tests__/arabicNormalize.test.js` -> `archive-core/src/__tests__/arabicNormalize.test.ts`
- Modify: `archive-core/package.json` exports if needed.

- [x] **Step 1: Run the existing test**

Run: `pnpm --filter @archive/core test -- src/__tests__/arabicNormalize.test.js`
Expected: PASS before conversion.

- [x] **Step 2: Rename files and add explicit types**

Keep the same runtime exports and add typed function signatures.

- [x] **Step 3: Run typecheck and tests**

Run: `pnpm run typecheck:core`
Expected: PASS.

Run: `pnpm --filter @archive/core test`
Expected: PASS.

### Task 3: Convert Small Server Config Utilities to TypeScript

**Files:**
- Pick leaf modules with existing tests under `archive-server/src/config` or `archive-server/src/auth`.
- Keep `.js` import specifiers compatible with tsx until package exports are intentionally changed.

- [x] **Step 1: Pick one tested leaf module**

Use `rg` to find small files with direct tests.

- [x] **Step 2: Convert one module and its test**

Preserve behavior and public import paths.

- [x] **Step 3: Verify**

Run: `pnpm run typecheck:server`
Expected: PASS.

Run the matching Vitest test.
Expected: PASS.

### Task 4: Docker Gate After Each Slice

**Files:**
- Dockerfiles and compose files only if a real Docker failure appears.

- [x] **Step 1: Run compose config gates**

Run: `pnpm run docker:config`
Expected: PASS.

Run: `pnpm run docker:config:postgres`
Expected: PASS.

- [x] **Step 2: Run image build gates**

Run: `docker compose --env-file archive-server/.env.example -f archive-server/docker-compose.yml build frontend`
Expected: PASS.

Run server image build when server-side TypeScript files change.

### Task 5: Track Remaining JavaScript Count

**Files:**
- Modify: `TASKS.md`

- [x] **Step 1: Count JS and TS files excluding generated folders**

Run: `rg --files -g "*.js" -g "*.jsx" -g "!node_modules/**" -g "!.claude/**" -g "!archive-app/dist*/**" | Measure-Object`

- [x] **Step 2: Update `TASKS.md`**

Record the new conversion slice and remaining migration direction.

Current count after this slice: 816 JS/JSX files and 30 TS/TSX files, excluding generated folders.

### Task 6: Convert Shared Core Ports and Small Runtime Utilities

**Files:**
- Modify/add: `archive-core/src/storage/ports/*.{js,ts}`
- Modify/add: `archive-core/src/storage/index.{js,ts}`
- Modify/add: `archive-core/src/core/index.{js,ts}`
- Modify/add: `archive-app/src/features/analytics/topTags.{js,ts}`
- Rename: `archive-app/src/features/analytics/topTags.test.js` -> `.ts`
- Modify/add: `archive-app/src/utils/classNames.{js,ts}`
- Modify/add: `archive-app/src/features/ui/countUp.{js,ts}`
- Rename: `archive-app/src/features/ui/countUp.test.js` -> `.ts`
- Modify/add: `archive-server/src/api/rateLimit.{js,ts}`
- Rename: `archive-server/src/api/__tests__/rateLimit.test.js` -> `.ts`

- [x] **Step 1: Convert `archive-core` ports to TS implementations with JS bridges**

Expected: `pnpm run verify:core`, `pnpm run typecheck:core`, and `pnpm --filter @archive/core test` pass.

- [x] **Step 2: Convert frontend top-tags utility and test**

Expected: app test slice and `pnpm run typecheck:app` pass.

- [x] **Step 3: Convert server rate limiter and test**

Expected: server test slice and `pnpm run typecheck:server` pass.

- [x] **Step 4: Run full gates**

Expected: `pnpm run typecheck`, compose config gates, Docker image build, and Docker dev smoke pass.

Current count after Task 6: 813 JS/JSX files and 45 TS/TSX files, excluding generated folders.

### Task 7: Convert Pure Frontend View Models

**Files:**
- Modify/add: `archive-app/src/features/theme/appearancePreview.{js,ts}`
- Rename: `archive-app/src/features/theme/appearancePreview.test.js` -> `.ts`
- Modify/add: `archive-app/src/features/settings/keyboardShortcuts.{js,ts}`
- Rename: `archive-app/src/features/settings/keyboardShortcuts.test.js` -> `.ts`
- Modify/add: `archive-app/src/features/help/viewModel.{js,ts}`
- Rename: `archive-app/src/features/help/viewModel.test.js` -> `.ts`
- Modify/add: `archive-app/src/features/recommendations/recommendationFeedback.{js,ts}`
- Rename: `archive-app/src/features/recommendations/recommendationFeedback.test.js` -> `.ts`

- [x] **Step 1: Convert low-risk view models with JS bridges**

Preserve public exports from `.js` files while moving implementations to typed `.ts` files.

- [x] **Step 2: Convert matching tests**

Rename matching tests to `.test.ts` and add explicit test helper types where TypeScript requires them.

- [x] **Step 3: Verify app type safety and behavior**

Run: `pnpm run typecheck:app`
Expected: PASS.

Run matching Vitest slices for theme, settings, help, and recommendations.
Expected: PASS. Current Vitest argument handling ran the full app suite successfully.

Current count after Task 7: 809 JS/JSX files and 53 TS/TSX files, excluding generated folders.

### Task 8: Convert Upload and File-Manager Utilities

**Files:**
- Modify/add: `archive-app/src/features/upload/uploadLink.{js,ts}`
- Rename: `archive-app/src/features/upload/uploadLink.test.js` -> `.ts`
- Modify/add: `archive-app/src/features/file-manager/ingestQueue.{js,ts}`
- Rename: `archive-app/src/features/file-manager/ingestQueue.test.js` -> `.ts`
- Modify/add: `archive-app/src/features/file-manager/archiveHandoff.{js,ts}`
- Rename: `archive-app/src/features/file-manager/archiveHandoff.test.js` -> `.ts`

- [x] **Step 1: Convert upload linking utility**

Use flexible file and metadata types to support browser `File` objects and test/upload mocks.

- [x] **Step 2: Convert ingest queue and archive handoff together**

Keep queue status literals typed and preserve JS bridge exports for current imports.

- [x] **Step 3: Verify app type safety and behavior**

Run: `pnpm run typecheck:app`
Expected: PASS.

Run matching Vitest slices for upload link, ingest queue, and archive handoff.
Expected: PASS. Current Vitest argument handling ran the full app suite successfully.

Current count after Task 8: 806 JS/JSX files and 59 TS/TSX files, excluding generated folders.

### Task 9: Convert File-Manager View Model

**Files:**
- Modify/add: `archive-app/src/features/file-manager/viewModel.{js,ts}`
- Rename: `archive-app/src/features/file-manager/viewModel.test.js` -> `.ts`

- [x] **Step 1: Convert path, breadcrumb, selection, and view-mode helpers**

Keep path validation behavior intact and type browser entries, breadcrumbs, and storage adapter shapes.

- [x] **Step 2: Convert matching test**

Rename the test to `.test.ts` and type the in-memory storage helper.

- [x] **Step 3: Verify app type safety and behavior**

Run: `pnpm run typecheck:app`
Expected: PASS.

Run: `pnpm --filter @archive/app run test -- src/features/file-manager/viewModel.test.ts`
Expected: PASS. Current Vitest argument handling ran the full app suite successfully.

Current count after Task 9: 805 JS/JSX files and 61 TS/TSX files, excluding generated folders.
