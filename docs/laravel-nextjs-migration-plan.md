# Laravel + Next.js Migration Plan

> Date: 2026-06-27
> Decision: pause Astro 5 work. Continue TypeScript and plan a Laravel API plus Next.js frontend migration.

## Recommendation

Use Laravel for the backend domain and operational services, and Next.js for the user interface. Do not replace the current app in one step. Run the new stack beside the existing Vite/React app until the API contracts and Playwright smoke tests are stable.

## Target Responsibilities

- Laravel: authentication, authorization policies, REST API, database migrations, file/storage abstraction, background queues, media jobs, audit logs, integrations, and admin-safe operational endpoints.
- Next.js: TypeScript UI, RTL Arabic shell, App Router, route-level loading/error states, server rendering for public/share pages, and client-heavy screens for archive operations.
- Current Vite app: stays as the working production surface during migration.
- TypeScript: remains the shared discipline for frontend code, tests, API clients, and future Next.js modules.

## Migration Order

1. Define API contracts first.
   - Write OpenAPI or JSON examples for items, content types, folders, files, auth/session, rights, and search.
   - Keep these contracts framework-neutral so both the current Node server and Laravel can satisfy them.

2. Keep TypeScript moving.
   - Continue converting leaf utilities, API clients, ports, hooks, and stores.
   - Avoid converting the current React root until a Next.js shell exists.

3. Scaffold Next.js only after contracts are clear.
   - Use a new package such as `archive-next`.
   - Reuse design tokens and Playwright helpers.
   - Start with low-risk pages: help, reports shell, public share viewer, and settings overview.
   - Status 2026-06-27: initial `archive-next` package exists with a TypeScript
     App Router shell that imports `docs/api/archive-contract.openapi.json`.
   - Status 2026-06-27: `archive-next/lib/archive-api.ts` provides the first
     typed API client for health, current user, search, rights, and share routes.
   - Status 2026-06-29: `archive-next` now owns the frontend migration surface
     for `/help`, `/reports`, `/settings`, and `/media/jobs`, all implemented as
     TypeScript App Router routes. Backend state and work remain behind Laravel
     `/api/v1/*` routes.

4. Scaffold Laravel API after domain mapping.
   - Map Prisma models to Laravel migrations.
   - Use Sanctum or HttpOnly session cookies.
   - Move background work to queues rather than request handlers.
   - Keep file storage compatible with local disk and S3-style stores.
   - Status 2026-06-27: initial `archive-laravel` scaffold exists. It serves
     `/api/v1/health` and `/api/v1/public/openapi.json`, with Feature tests.
   - Status 2026-06-27: baseline migrations exist for `storage_rows` and
     `rights_records`, matching the first records/rights contract surfaces.
   - Status 2026-06-27: the first rights route group exists under
     `/api/v1/rights`, including fetch, upsert, expiring records, and
     enforcement status Feature tests.
   - Status 2026-06-27: Laravel rights routes are protected by a temporary
     internal API-key middleware (`ARCHIVE_API_KEY`) while Sanctum/session
     cookies remain the target production auth model.
   - Status 2026-06-27: Laravel records compatibility routes exist for
     `GET /api/v1/records` and `POST /api/v1/records/bulk`, backed by
     `storage_rows` and covered by Feature tests.
   - Status 2026-06-27: Laravel search route exists at `/api/v1/search` as a
     keyword compatibility layer over `storage_rows`; semantic search remains
     a later route-level enhancement.
   - Status 2026-06-27: Laravel file browser routes exist at `/api/v1/files`
     and `/api/v1/files/browser`, backed by `ARCHIVE_FILE_ROOT` with path
     traversal checks.
   - Status 2026-06-27: Laravel public share routes exist for protected share
     creation and public token payload reads backed by `share_links`.
   - Status 2026-06-27: Laravel protected mutating API calls are recorded in
     `audit_logs` through `archive.audit`.
   - Status 2026-06-27: `audit_logs` now includes searchable event taxonomy
     fields: event, resource type/id, actor, and outcome.
   - Status 2026-06-27: Laravel media workflow jobs now have a contract,
     `media_jobs` tracking table, protected API routes, and a queue job boundary
     for thumbnail/transcode/transcription work.
   - Status 2026-06-27: Laravel auth routes now issue short-lived bearer
     access tokens plus a `va_refresh` HttpOnly refresh cookie backed by
     `api_sessions`.
   - Status 2026-06-27: the internal `X-Archive-Api-Key` fallback was removed;
     Laravel protected routes now require bearer access tokens or the refresh
     cookie flow.

5. Run both stacks in parallel.
   - Current Vite app remains the fallback.
   - Playwright gates must pass on each moved route.
   - Switch traffic route-by-route only after parity is proven.
   - Status 2026-06-27: `pnpm run e2e:next` runs the first Next.js smoke test
     through the existing Playwright harness against `E2E_BASE_URL`.
   - Status 2026-06-27: the Next.js API client now supports the Laravel
     login/me/refresh/logout flow with `credentials: "include"` and optional
     bearer access tokens for protected routes.
   - Status 2026-06-27: `/login` exists in `archive-next` as the first browser
     auth screen using the typed Laravel auth client; Playwright covers it on
     desktop and mobile.
   - Status 2026-06-27: `/share/[token]` exists in `archive-next` as the first
     low-risk public viewer route. It uses the typed share client and is covered
     by the Next.js Playwright smoke suite on desktop and mobile.
   - Status 2026-06-27: Next.js can proxy `/api/v1/*` to a live Laravel API
     through `ARCHIVE_API_BASE_URL`, and `pnpm run e2e:next:integration`
     verifies `/share/[token]` against a seeded Laravel SQLite database.
   - Status 2026-06-29: the Next.js frontend shell now exposes the migrated
     help, reports, settings, public share, login, and media job status routes.
     The media jobs UI calls the typed `mediaJob()` client against
     `/api/v1/media/jobs/:id`; job creation, queue lifecycle, and processors stay
     in Laravel. Verified with `pnpm run typecheck:next`,
     `pnpm run build:next`, and
     `E2E_BASE_URL=http://127.0.0.1:8993 pnpm run e2e:next` (14 passed).

## Why Not Astro Now

Astro is good for content-heavy sites and islands, but this product is an operational archive application with deep authenticated workflows, stateful dashboards, offline/local storage, and future backend migration needs. Next.js fits the planned TypeScript frontend better, and Laravel gives a stronger backend platform for policies, queues, storage, and enterprise integrations.

## Immediate Next Tasks

- Keep the TypeScript foundation and leaf conversions.
- Remove Astro dependencies, scripts, config, and generated artifacts.
- Add API contract documentation before scaffolding Laravel or Next.js.
  - Initial contract: `docs/api/archive-contract.openapi.json`.
- Keep `archive-next` as the TypeScript frontend migration surface. Current
  migrated low-risk routes are `/help`, `/reports`, `/settings`, `/login`,
  `/share/[token]`, and `/media/jobs`.
- Keep `archive-laravel` parallel to the Node server until auth, records,
  search, files, rights, and share route groups match the contract.
- Keep Laravel as the backend/API boundary for auth, policies, file access,
  audit logs, media jobs, and queues. Next.js should not absorb backend
  processors.
- Remaining work: expand authenticated operational route parity, run live
  integration checks for more than the share viewer, and replace Laravel media
  job placeholders with real processors.
- Decide whether `archive-server` remains as an adapter during Laravel migration or becomes a reference implementation only.
