# SPA / Cloud Separation + Production-Readiness — Design

Date: 2026-05-30

## Context

The Video Archive app currently ships as an **offline-first SPA**: React 19 + Vite 7
+ `vite-plugin-singlefile`, all persistence in IndexedDB behind the
`dbGet / dbPut / dbGetAll / dbDelete` wrappers (`src/services/storage/`), no
backend. The full CLOUD-MediaDB feature roadmap is complete (PR0–PR11 + rating),
and the codebase is already **cloud-migration-aware**: feature logic is pure and
storage-agnostic, and sync scaffolding exists (`deviceId`, `syncVersion`,
`lastModifiedBy`, conflict detection + 3-way merge, `audit_logs`, and PR10
field-level diffs).

The goal: **separate the offline SPA distribution from a cloud production
distribution**, and prepare the system to run as a **professional production
system** — without forking, and without rewriting feature code.

## Decisions (from brainstorming)

1. **Deployment model:** single private organization, self-hosted, multiple users
   with roles. Single tenant — **no** multi-tenancy, **no** billing (YAGNI).
2. **Storage is pluggable (ports & adapters).** The user wants freedom, not
   vendor lock-in. Two seams:
   - **Data backend** (metadata DB + auth + realtime).
   - **File storage** (blobs: thumbnails / small files), pluggable to
     Dropbox / FTP / S3 / local.
3. **Default cloud data backend: PocketBase** — a single self-hostable Go binary
   (SQLite + auth + realtime + REST + admin UI + file storage), free, trivial ops.
   The adapter interface keeps **Supabase** / a custom backend as drop-in
   alternatives later, without touching the core.
4. **Starting sync scope:** metadata + thumbnails + small files. Large video
   files stay referenced (local paths) for now; the FileStore port is built to
   extend to large-file upload later.
5. **Separation mechanism:** one monorepo, a shared storage-agnostic core, and
   **two Vite build targets** (`spa`, `cloud`) — Approach A.
6. **Docker support** is a first-class deliverable: a `docker-compose` that runs
   the cloud app + PocketBase (+ volumes/backups), plus a Dockerfile for the
   cloud web build.

## Non-goals (YAGNI)

- Multi-tenant SaaS, organizations, billing.
- Uploading full/large video files to the cloud in the initial phases.
- Replacing the SPA — it remains a first-class shipped product (offline,
  single-file, zero backend).

## Architecture

```
src/
  core/                         # storage-agnostic: stores, UI, the 11 features
  storage/
    ports/
      StorageProvider.js        # interface: get/put/getAll/delete/query/tx
      FileStore.js              # interface: putBlob/getUrl/remove/list
      AuthProvider.js           # interface: signIn/signOut/currentUser/onChange
      SyncProvider.js           # interface: subscribe/pushChange/pullSince
    adapters/
      local-indexeddb/          # CURRENT behavior → the SPA data adapter
      local-auth/               # CURRENT bcrypt/RBAC → SPA auth adapter
      cloud-pocketbase/         # data + auth + realtime adapter (default cloud)
      files-local/  files-dropbox/  files-ftp/  files-s3/
  targets/
    spa/    bootstrap.spa.js     # wires local adapters; single-file build
    cloud/  bootstrap.cloud.js   # wires cloud adapters + auth + sync
```

- **`StorageProvider`** formalizes the existing `dbGet/dbPut/dbGetAll/dbDelete`
  into an explicit interface. The current IndexedDB code becomes `LocalAdapter`
  with **zero behavior change** for the SPA. Feature code keeps calling the same
  surface, so the 11 features run unchanged on either adapter.
- **`FileStore`** abstracts blob storage (thumbnails / small files now). Local
  adapter first; Dropbox / FTP / S3 adapters are independent of the data backend.
- **`AuthProvider`** / **`SyncProvider`** abstract auth + live sync so the SPA
  keeps its local bcrypt/RBAC + offline behavior while the cloud target uses
  PocketBase auth + realtime.
- **Build targets:** `VITE_TARGET=spa` → `vite-plugin-singlefile`, local adapters,
  no server (today's behavior). `VITE_TARGET=cloud` → standard multi-file build,
  cloud adapters, server auth, live sync. Selected via env at build time;
  the bootstrap file wires the matching adapter set.

## Cloud version specifics

- **Data backend (default PocketBase):** map each IndexedDB store to a PocketBase
  collection (`video_items`, `content_types`, `bookmarks`, `virtual_collections`,
  `hierarchical_tags`, `vocabulary`, `users`, `audit_logs`, `change_history`,
  `video_relations`, `app_settings`). Access rules enforce the single-org role
  model server-side (admin/editor/viewer).
- **Auth:** PocketBase is the credential source of truth; the app's existing RBAC
  roles are mirrored onto PocketBase user records. The local-auth adapter remains
  for the SPA.
- **Sync:** reuse the existing engine — `deviceId` + `syncVersion` +
  `lastModifiedBy` + conflict detection + 3-way merge + `audit_logs` + PR10
  field-level diffs — layered over PocketBase realtime subscriptions (live
  push) and a pull-since query (catch-up), with an offline write queue.
- **File storage:** `FileStore` port; start with thumbnails / small files via a
  local or Dropbox/FTP adapter; large-video upload deferred.

## Docker support

- **`Dockerfile`** (multi-stage) building the cloud web target → static assets
  served by a small static server (or PocketBase's `pb_public`).
- **`docker-compose.yml`** running: (a) PocketBase (data+auth+realtime+files,
  persistent volume `pb_data`), (b) the cloud web app. Env via `.env`
  (PocketBase URL, admin bootstrap, file-adapter creds). Documented backup of the
  `pb_data` volume.
- The SPA target needs no Docker — it stays a static single file (open directly
  or host anywhere).

## Production-readiness work plan (phased — each phase = its own spec → plan → PRs)

- **Phase 0 — Separation & foundation.** Extract `StorageProvider` + `FileStore`
  (+ `AuthProvider`/`SyncProvider`) ports; refactor current code into the
  `local-*` adapters (no behavior change); split the build via `VITE_TARGET`;
  keep `npm run verify` + single-file SPA build green.
- **Phase 1 — Quality gates.** Promote the bespoke `verify-modules` checks into a
  real unit/integration test suite; add CI (lint + test + both builds) on PRs;
  add a React error boundary + centralized error reporting.
- **Phase 2 — PocketBase data adapter.** Collections/schema + access rules; the
  `cloud-pocketbase` data + auth adapter implementing the ports.
- **Phase 3 — Sync engine.** Wire conflict-merge + realtime + offline queue +
  per-entity versioning end-to-end against PocketBase.
- **Phase 4 — File storage adapters.** `FileStore` + Dropbox/FTP adapters for
  thumbnails / small files.
- **Phase 5 — Production hardening + Docker.** Security (auth hardening, secrets,
  access-rule audit), observability (structured logs, health endpoint, metrics),
  backups/restore, the Dockerfile + docker-compose, env/config management,
  operator runbooks.
- **Phase 6 — Release & migration.** Migrate existing IndexedDB data → cloud using
  the existing transfer/delta packages as the bridge; versioning; staged rollout.

## Verification per phase

- `npm run verify` + **both** builds green (`spa` single-file preserved; `cloud`
  multi-file). No heavy deps leak into the SPA bundle.
- New tests pass in CI; manual smoke per phase.
- Subagent two-stage review (spec compliance + code quality) before merge, per
  existing discipline.

## Open questions (resolve at each phase's plan time)

- PocketBase auth ↔ existing RBAC reconciliation details (mirror vs. delegate).
- Exact offline-queue conflict UX when the same record changed on server + client.
- Which file adapter ships first (local vs Dropbox) in Phase 4.
