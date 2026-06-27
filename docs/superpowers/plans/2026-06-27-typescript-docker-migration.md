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
