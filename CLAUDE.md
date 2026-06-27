# archive-suite

pnpm monorepo for the Archive Suite. It has **three layers**:
- **Frontend (current):** `archive-app` — React 19 SPA (Vite, Tailwind v4)
- **Frontend (migrating to):** `archive-next` — Next.js 16 + TypeScript (App Router)
- **Backend (current/reference):** `archive-server` — Node.js/ESM, Prisma (Postgres + PocketBase)
- **Backend (migrating to):** `archive-laravel` — Laravel 13 PHP API
- **Shared:** `archive-core` — shared library consumed by both frontends

A **gradual migration** to TypeScript (frontend + server) + a Laravel API + a Next.js TS frontend is in progress. The Node server and React SPA remain the reference/running implementation until each route group reaches contract parity in Laravel/Next.js. See `TASKS.md` for slice-by-slice status and `archive-laravel/ARCHIVE_MIGRATION.md` for the Laravel migration plan.

> Note: `archive-laravel` is a PHP project managed by Composer; it is **not** part of the pnpm workspace (`pnpm-workspace.yaml` lists `archive-app`, `archive-core`, `archive-next`, `archive-server`).

## Stack

- **Frontend:** React 19, Vite 8, Tailwind v4, framer-motion, i18next (RTL); Next.js 16 + TypeScript (new shell)
- **Backend:** Node.js/ESM, Prisma (Postgres + PocketBase adapters); Laravel 13 PHP API (parallel target)
- **Testing:** Vitest, Playwright, Testing Library, axe-core (a11y); PHPUnit (Laravel)
- **Type system:** TypeScript in progress — root `tsconfig.base.json` + per-package `tsconfig.json` (strict, `strictNullChecks`). `archive-app` and `archive-server` are mostly JS today; `archive-next` is fully TS.
- **Package manager:** pnpm 11 (workspace)

## Commands

### Dev
```bash
pnpm dev                    # frontend dev server (React SPA)
pnpm dev:next               # Next.js dev server (migrating frontend)
pnpm server                 # backend Node server
```

### Build
```bash
pnpm build:spa              # SPA build (offline)
pnpm build:cloud            # cloud build (primary direction)
pnpm build:next             # Next.js production build
```

### Test & verify
```bash
pnpm verify                 # run all package verify scripts
pnpm verify:app             # frontend (SPA) only
pnpm verify:server          # server only
pnpm verify:core            # core only
pnpm verify:api-contracts   # validate shared OpenAPI contract
pnpm typecheck              # typecheck all TS packages
pnpm --filter @archive/app run test      # unit tests (vitest)
pnpm --filter @archive/app run e2e       # Playwright E2E (SPA)
pnpm e2e:next                           # Playwright smoke on Next.js shell
pnpm security:baseline                  # security baseline check
```

### Laravel (run via Docker — no local PHP/Composer needed)
```bash
docker run --rm -v "D:\archiveaq\Arch_App:/app" -w /app/archive-laravel composer:latest php artisan test
```
> On Git Bash (Windows), prefix the command with `MSYS_NO_PATHCONV=1` so the `-w /app/...` path isn't rewritten to a Windows path.

### Release gate
```bash
pnpm release:verify         # full verify + build + security check
```

## Notes

- Two SPA build modes: `spa` (offline) and `cloud` (PocketBase/Postgres) — cloud is the primary direction
- Server supports multiple storage backends: S3, Azure, Dropbox, Google Drive
- AI SDK integrates Anthropic, OpenAI, Google, Groq, Mistral, OpenRouter
- The Laravel API currently uses a temporary `ARCHIVE_API_KEY` guard (`X-Archive-Api-Key` / Bearer) until Sanctum/session cookies are added
- Shared API contract source: `docs/api/archive-contract.openapi.json`
- Migration planning: `docs/laravel-nextjs-migration-plan.md`, `archive-laravel/ARCHIVE_MIGRATION.md`
