# Compatible Runtime Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline, task-by-task execution. Do not dispatch subagents.

**Goal:** Refresh the canonical development stack to the latest compatible Node 22, Next 16, Laravel 13, and PostgreSQL 17 images while preserving immutable image pins.

**Architecture:** Keep the existing major-version contracts intact: Node remains on 22 LTS, Next remains 16, Laravel remains 13, and PostgreSQL remains 17 with pgvector. Update package lockfiles and immutable Docker digests together, then verify the canonical Laravel + Next flow.

**Tech Stack:** pnpm 11.9, Next.js 16, Laravel 13/PHP 8.4, Docker Compose, pgvector/PostgreSQL 17.

## Global Constraints

- Node baseline: `22.23.1`; supported engine: `>=22.23.1 <23`.
- Next target: `16.2.10`.
- Laravel target: latest Composer-compatible Laravel 13 patch (`13.20.0` at planning time).
- PostgreSQL remains `pg17`; pin Linux amd64 pgvector digest `815bf5378222044da3b34d98e6a5fdac37b15c428b67d09c7c2d90a038e597bf`.
- Never stage pre-existing unrelated workspace changes.

---

### Task 1: Refresh Node and Next.js contract

**Files:**
- Modify: `package.json`, `archive-next/package.json`, `pnpm-lock.yaml`
- Modify: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Modify: `archive-next/Dockerfile`, `infra/platform/toolchain.v1.json`, `scripts/node-version.mjs`, `infra/platform/compatibility.v1.json`, `README.md`, `TASKS.md`

- [x] Update Node baseline occurrences from `22.13.0` to `22.23.1`, with Docker pin `node:22.23.1-alpine@sha256:b74031e546d7f4faf561d797ac1b76beccac856a042815ca77db4fd047581605`.
- [x] Run `pnpm --filter @archive/next update next@16.2.10` under Node 22.23.1.
- [x] Run `pnpm typecheck` and `pnpm build:next` under Node 22.23.1.

### Task 2: Refresh Laravel 13 dependencies

**Files:**
- Modify: `archive-laravel/composer.lock`

- [x] Run `node scripts/laravel-docker.mjs composer update laravel/framework --with-all-dependencies --no-interaction` under Node 22.23.1.
- [x] Run `pnpm verify:laravel` and `pnpm verify:api-contracts`.

### Task 3: Refresh PostgreSQL 17 image pins

**Files:**
- Modify: `infra/docker-compose.yml`, `infra/docker-compose.laravel-next.yml`, `infra/platform/release.v1.json`, `scripts/offline-bundle.test.mjs`

- [x] Replace the pgvector PostgreSQL 17 digest with `815bf5378222044da3b34d98e6a5fdac37b15c428b67d09c7c2d90a038e597bf` consistently.
- [x] Update the official PostgreSQL 17 Alpine Kubernetes digest to `af194ccf3e2d7fe367012c7b88ce8b816c5c889b18a5b316799a1f0d7eac746a`.
- [x] Run `pnpm docker:config` and `pnpm verify:infra`.

### Task 4: Final verification and commit

**Files:**
- Modify: `ChangeLog.md`

- [x] Run `pnpm verify:laravel-next` under Node 22.23.1.
- [x] Record the compatible runtime refresh in `ChangeLog.md`.
- [x] Run `git diff --check`, stage only refresh files, and commit with `chore(runtime): refresh compatible platform dependencies`.
