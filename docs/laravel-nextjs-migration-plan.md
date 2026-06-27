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

5. Run both stacks in parallel.
   - Current Vite app remains the fallback.
   - Playwright gates must pass on each moved route.
   - Switch traffic route-by-route only after parity is proven.
   - Status 2026-06-27: `pnpm run e2e:next` runs the first Next.js smoke test
     through the existing Playwright harness against `E2E_BASE_URL`.

## Why Not Astro Now

Astro is good for content-heavy sites and islands, but this product is an operational archive application with deep authenticated workflows, stateful dashboards, offline/local storage, and future backend migration needs. Next.js fits the planned TypeScript frontend better, and Laravel gives a stronger backend platform for policies, queues, storage, and enterprise integrations.

## Immediate Next Tasks

- Keep the TypeScript foundation and leaf conversions.
- Remove Astro dependencies, scripts, config, and generated artifacts.
- Add API contract documentation before scaffolding Laravel or Next.js.
  - Initial contract: `docs/api/archive-contract.openapi.json`.
- Keep `archive-next` as a migration shell until route-level parity and E2E
  checks are added.
- Keep `archive-laravel` parallel to the Node server until auth, records,
  search, files, rights, and share route groups match the contract.
- Next Laravel route groups should move from the temporary API-key guard to
  HttpOnly cookie sessions or Sanctum before browser-facing production use.
- Decide whether `archive-server` remains as an adapter during Laravel migration or becomes a reference implementation only.
