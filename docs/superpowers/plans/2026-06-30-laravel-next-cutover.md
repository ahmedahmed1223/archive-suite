# Laravel Next Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Next.js + Laravel the canonical Archive Suite development path and move Vite/Node to explicit legacy reference commands.

**Architecture:** Root commands point to `archive-next` and `archive-laravel`; legacy Vite/Node commands remain available only under `legacy:*`. A cutover verification script prevents accidental regression to old defaults, and a live integration script runs Laravel + Next.js with Playwright.

**Tech Stack:** pnpm workspace, Next.js 16, Laravel 13 through Docker Composer image, Playwright, Node.js ESM scripts.

---

### Task 1: Root Command Cutover

**Files:**
- Modify: `package.json`
- Create: `scripts/verify-cutover-defaults.mjs`

- [x] **Step 1: Write failing cutover verification**

Expected checks:
- `dev` equals `node scripts/dev-laravel-next.mjs`
- `build` equals `pnpm run build:next`
- `verify` equals `pnpm run verify:laravel-next`
- legacy commands exist explicitly

- [x] **Step 2: Run RED**

Run: `node scripts/verify-cutover-defaults.mjs`

Expected: fails because root `dev` still points to `@archive/app`.

- [x] **Step 3: Switch root scripts**

Set canonical scripts for `dev`, `build`, `verify`, `server`, and leave Vite/Node under `legacy:*`.

### Task 2: Docker Laravel Helpers

**Files:**
- Create: `scripts/laravel-docker.mjs`
- Create: `scripts/dev-laravel-next.mjs`
- Create: `scripts/verify-next-laravel-live.mjs`

- [x] **Step 1: Add helper to run Laravel through Docker**

Use `composer:latest` with the repository mounted at `/app`.

- [x] **Step 2: Add combined dev runner**

Start Laravel on port `8950` and Next.js on port `8951` with `ARCHIVE_API_BASE_URL` set to Laravel `/api/v1`.

- [x] **Step 3: Add live verification runner**

Start both services, wait for `/api/v1/health`, then run `tests/next-laravel-integration.spec.ts`.

### Task 3: Documentation And Status

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `INSTALL.md`
- Modify: `DEPLOYMENT.md`
- Modify: `docs/laravel-nextjs-migration-plan.md`
- Modify: `archive-laravel/ARCHIVE_MIGRATION.md`
- Modify: `TASKS.md`
- Modify: `ChangeLog.md`

- [x] **Step 1: Mark Next/Laravel as canonical**

Describe `archive-next` and `archive-laravel` as the default path.

- [x] **Step 2: Mark Vite/Node as legacy/reference**

Document that no net-new work belongs in `archive-app` or `archive-server`.

- [x] **Step 3: Update task status**

Mark Laravel/Next cutover complete and retain worker/FTP/SMB live smoke as later hardening.

### Task 4: Verify

**Files:**
- Modify: `scripts/verify-release-readiness.mjs`

- [x] **Step 1: Update release readiness checks**

Assert root defaults, Laravel API routes, Next rewrite, and canonical docs.

- [ ] **Step 2: Run verification**

Run:

```bash
node scripts/verify-cutover-defaults.mjs
pnpm run typecheck
pnpm run build:next
pnpm run verify:laravel
pnpm run verify:laravel-next:live
```
