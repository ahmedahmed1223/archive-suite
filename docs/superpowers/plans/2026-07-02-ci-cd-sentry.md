# CI/CD and Sentry Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canonical CI/CD gate for the Laravel + Next.js stack and wire Sentry error monitoring for both runtime halves.

**Architecture:** GitHub Actions runs repository gates against the same root scripts developers use locally, then builds the default Docker Next image to catch deployment drift. Sentry is opt-in through environment variables: Next.js initializes client/server/edge SDKs only when DSNs are present, and Laravel registers Sentry's exception handler with a config file that remains inert without `SENTRY_LARAVEL_DSN`.

**Tech Stack:** GitHub Actions, pnpm 11, Node.js 22, Docker Compose, Next.js 16 App Router, Laravel 13, `@sentry/nextjs`, `sentry/sentry-laravel`.

---

### Task 1: CI/CD Workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/docker.yml`
- Modify: `scripts/verify-release-readiness.mjs`
- Modify: `README.md`

- [ ] **Step 1: Add CI workflow**

Create `.github/workflows/ci.yml` with jobs for install, `pnpm run verify:cutover`, `pnpm run verify:api-contracts`, `pnpm run typecheck:next`, `pnpm run build:next`, `pnpm run verify:repo-hygiene`, `pnpm run security:baseline`, `pnpm run security:audit`, and static release readiness.

- [ ] **Step 2: Add Docker build workflow**

Create `.github/workflows/docker.yml` to run `docker compose --env-file archive-server/.env.example -f archive-server/docker-compose.yml config` and build `next`.

- [ ] **Step 3: Guard workflows**

Update `scripts/verify-release-readiness.mjs` to assert both workflow files exist and include the canonical commands.

- [ ] **Step 4: Document CI/CD**

Add a concise README section listing required GitHub secrets for optional Sentry source maps.

### Task 2: Sentry for Next.js

**Files:**
- Modify: `archive-next/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `archive-next/next.config.mjs`
- Create: `archive-next/instrumentation.ts`
- Create: `archive-next/instrumentation-client.ts`
- Create: `archive-next/sentry.server.config.ts`
- Create: `archive-next/sentry.edge.config.ts`
- Create: `archive-next/app/global-error.tsx`
- Modify: `archive-next/.env.example`
- Modify: `archive-next/Dockerfile`
- Modify: `archive-server/docker-compose.yml`
- Modify: `archive-server/docker-compose.laravel-next.yml`

- [ ] **Step 1: Install SDK**

Run `pnpm --filter @archive/next add @sentry/nextjs`.

- [ ] **Step 2: Configure SDK files**

Initialize client/server/edge SDKs with `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, and conservative sample rates.

- [ ] **Step 3: Wrap Next config**

Use `withSentryConfig` with `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` for source-map uploads in CI only.

- [ ] **Step 4: Pass Docker env**

Expose Sentry DSN/release/environment args to the Next Docker build without hardcoding secrets.

### Task 3: Sentry for Laravel

**Files:**
- Modify: `archive-laravel/composer.json`
- Modify: `archive-laravel/composer.lock`
- Modify: `archive-laravel/bootstrap/app.php`
- Create: `archive-laravel/config/sentry.php`
- Modify: `archive-laravel/.env.example`
- Modify: `archive-server/.env.example`
- Modify: `archive-server/docker-compose.yml`
- Modify: `archive-server/docker-compose.laravel-next.yml`

- [ ] **Step 1: Install SDK**

Run `composer require sentry/sentry-laravel` from `archive-laravel`.

- [ ] **Step 2: Register exception integration**

Add `Sentry\Laravel\Integration::handles($exceptions)` in `bootstrap/app.php`.

- [ ] **Step 3: Add config/env**

Add `config/sentry.php` using `SENTRY_LARAVEL_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, and optional trace/profile rates.

- [ ] **Step 4: Pass Docker env**

Add Laravel Sentry environment variables to the default and explicit Laravel/Next compose files.

### Task 4: Verification and Commit

**Files:**
- Modify: `ChangeLog.md`
- Modify: `TASKS.md`

- [ ] **Step 1: Run verification**

Run `pnpm run typecheck:next`, `pnpm run build:next`, `pnpm run verify:infra`, `pnpm run verify:repo-hygiene`, `node scripts/verify-release-readiness.mjs`, and `git diff --check`.

- [ ] **Step 2: Build Docker Next image**

Run `docker compose --env-file archive-server/.env.example -f archive-server/docker-compose.yml build next`.

- [ ] **Step 3: Commit**

Commit as `feat(ci): add pipeline and sentry integration`.
