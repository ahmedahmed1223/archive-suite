# Multi-Port Cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build cloud-backed sessions, file storage, and polling sync while preserving the local offline app path.

**Architecture:** `archive-core` defines the new/extended provider contracts. `archive-server` exposes file and sync HTTP endpoints behind the existing JWT gate. `archive-app` registers cloud session/file/sync adapters when the saved backend choice is not local.

**Tech Stack:** ESM, Node HTTP server, `@archive/core` provider registry, Vite SPA, existing verify scripts.

---

### Task 1: Core Contracts

**Files:**
- Create: `archive-core/src/storage/ports/SessionProvider.js`
- Modify: `archive-core/src/storage/ports/FileStore.js`
- Modify: `archive-core/src/storage/index.js`
- Modify: `archive-core/src/core/index.js`
- Modify: `archive-core/scripts/verify-core.mjs`

- [ ] Write a failing core contract test for `SESSION_PROVIDER_METHODS`, `isSessionProvider`, registry throw/register/get, and `FILE_STORE_METHODS` including `getBlob`.
- [ ] Run `npm run verify` in `archive-core` and confirm it fails because the new contract is missing.
- [ ] Add `SessionProvider` port and registry functions.
- [ ] Extend `FileStore` with `getBlob`.
- [ ] Run `npm run verify` in `archive-core` and confirm it passes.

### Task 2: Server File And Sync Endpoints

**Files:**
- Create: `archive-server/src/adapters/files-disk/index.js`
- Create: `archive-server/src/adapters/cloud-sync/index.js`
- Modify: `archive-server/src/bootstrap/registerCloudProviders.js`
- Modify: `archive-server/src/api/server.js`
- Modify: `archive-server/scripts/verify-api.mjs`

- [ ] Write failing server API tests for authenticated `PUT/GET/DELETE /api/files/:key`, `GET /api/files?prefix=`, `POST /api/sync/push`, and `GET /api/sync/pull?cursor=`.
- [ ] Run `npm run verify:api` in `archive-server` and confirm the new tests fail because routes/providers are missing.
- [ ] Implement disk-backed `FileStore` with `putBlob`, `getBlob`, `getUrl`, `remove`, and `list`.
- [ ] Implement polling `SyncProvider` transport over the active `StorageProvider`.
- [ ] Wire file/sync providers in `registerCloudProviders`.
- [ ] Add authenticated file and sync routes to `createApiServer`.
- [ ] Run `npm run verify:api` and then `npm run verify` in `archive-server`.

### Task 3: App Cloud Providers

**Files:**
- Create: `archive-app/src/storage/adapters/cloud-files/index.js`
- Create: `archive-app/src/storage/adapters/cloud-sync/index.js`
- Create: `archive-app/src/storage/adapters/local-session/index.js`
- Modify: `archive-app/src/bootstrap/cloudSession.js`
- Modify: `archive-app/src/bootstrap/registerLocalProviders.js`
- Modify: `archive-app/src/bootstrap/registerByBackendChoice.js`
- Modify: `archive-app/src/stores/slices/authSlice.js`
- Modify: `archive-app/scripts/verify-modules.mjs`

- [ ] Write failing app tests proving cloud mode registers session/files/sync, `authStore.login` uses `SessionProvider.signIn`, cloud files send Bearer requests, and cloud sync sends Bearer requests.
- [ ] Run `npm run verify` in `archive-app` and confirm the new tests fail because providers/adapters are missing.
- [ ] Add local no-op session provider for local mode.
- [ ] Turn `cloudSession.js` into a `createCloudSessionProvider` while keeping `loginToCloud` compatibility.
- [ ] Add cloud file and cloud sync adapters.
- [ ] Register cloud session/files/sync providers from `registerByBackendChoice`.
- [ ] Update `authSlice` to call `getSessionProvider()` for cloud login/logout.
- [ ] Run `npm run verify`, `npm run build:spa`, and `npm run build:cloud` in `archive-app`.

### Task 4: Dependency And PR Hygiene

**Files:**
- Modify: `archive-app/package.json`
- Modify: `archive-app/package-lock.json`
- Modify: `archive-server/package.json`
- Modify: `archive-server/package-lock.json`
- Modify: `archive-app/TASKS.md`

- [ ] Push the core branch first so app/server can install `@archive/core` from the matching feature branch.
- [ ] Update app/server `@archive/core` dependency to the feature branch during development.
- [ ] Run all repository gates: core verify, server verify, app verify/builds.
- [ ] Mark P1 #4 done in `TASKS.md` after all gates pass.
- [ ] Commit and open PRs in core, server, and app in that order.
