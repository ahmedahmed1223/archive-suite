# Local Session and Live Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline, task-by-task execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local setup sessions work without broadening refresh-token scope, then prove the real administrator workflow in the running stack.

**Architecture:** Laravel issues a second HttpOnly session-presence cookie scoped to `/`; Next uses only that cookie for proxy navigation. The refresh cookie remains limited to its endpoint. Control Center selects the development adapter when source mode is explicitly enabled and normalizes loopback HTTP cookie configuration.

**Tech Stack:** Laravel 13/PHP 8.4, Next.js 16/React 19, Node 22, Docker Compose, Playwright CLI.

## Global Constraints

- Keep `va_refresh` scoped to `/api/v1/auth/refresh` and HttpOnly with SameSite Strict.
- Presence cookie must never be accepted by Laravel API authentication.
- HTTPS/production keeps `ARCHIVE_SECURE_COOKIES=true`; only loopback HTTP local development uses false.
- Run no agents; commit each completed task on `master`.

---

### Task 1: Separate navigation presence from refresh authentication

**Files:**
- Modify: `archive-laravel/config/archive.php`, `archive-laravel/app/Http/Controllers/Api/V1/AuthController.php`, `archive-laravel/tests/Feature/AuthApiTest.php`, `archive-next/proxy.ts`

- [ ] Add a failing Laravel test that login emits `va_session` at `/`, while `va_refresh` remains at `/api/v1/auth/refresh`, and logout clears both.
- [ ] Add `session_cookie` configuration and issue/clear the presence cookie in login, refresh, and logout; do not read it in `sessionFromRefreshCookie`.
- [ ] Make the Next proxy require `ARCHIVE_SESSION_COOKIE`/`va_session`, not the refresh cookie.
- [ ] Run `pnpm verify:laravel`, `pnpm typecheck`, and commit `fix(auth): separate navigation session cookie`.

### Task 2: Make source lifecycle commands work through Setup-Archive.bat

**Files:**
- Modify: `scripts/control-center.mjs`, `scripts/control-center.test.mjs`, `infra/.env.example`

- [ ] Add a failing Control Center test proving development lifecycle commands use `developmentHealthCheck` rather than a release manifest.
- [ ] Route lifecycle commands to the development adapter only when `ARCHIVE_DEVELOPMENT_MODE=1`.
- [ ] Normalize `ARCHIVE_SECURE_COOKIES=false` only when `APP_BASE_URL` is loopback HTTP; retain `true` for any HTTPS or non-loopback URL.
- [ ] Run Control Center tests and commit `fix(setup): support local source lifecycle`.

### Task 3: Live administrator acceptance journey

**Files:**
- Create: `archive-next/e2e/live-admin-workflow.spec.ts` if reusable automation is practical
- Modify: `ChangeLog.md`

- [ ] Restart via `Setup-Archive.bat quick` with Node 22 and verify `Setup-Archive.bat health` succeeds.
- [ ] In a real browser, login, reload, create or select a record type and classification, upload a uniquely named real audio asset, save metadata, search it, start transcription, and wait for its actual terminal result.
- [ ] Verify the resulting transcript is rendered or report the processor's explicit failure; capture no credentials or tokens in artifacts.
- [ ] Run targeted live verification, update `ChangeLog.md`, and commit `test(acceptance): exercise local administrator workflow`.
