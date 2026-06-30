# archive-suite

pnpm monorepo for the Archive Suite. It has **canonical layers**:
- **Frontend (canonical):** `archive-next` — Next.js 16 + TypeScript (App Router)
- **Backend (canonical):** `archive-laravel` — Laravel 13 PHP API
- **Shared:** `archive-core` — shared library consumed by the frontend/API clients
- **Legacy reference:** `archive-app` (Vite SPA) and `archive-server` (Node.js/Prisma server)

The Laravel + Next.js cutover is the default development path. New product work goes through the shared API contract, Laravel `/api/v1/*`, and Next.js routes. The Node server and React SPA remain as legacy reference/fallback code only while unmatched operational edges are retired; do not add net-new features there.

> Note: `archive-laravel` is a PHP project managed by Composer; it is **not** part of the pnpm workspace (`pnpm-workspace.yaml` lists `archive-app`, `archive-core`, `archive-next`, `archive-server`).

## Stack

- **Frontend:** Next.js 16 + TypeScript; React 19; App Router; RTL UI
- **Backend:** Laravel 13 PHP API with HttpOnly refresh-cookie auth, records/search/files/share/rights/media/ingest route groups
- **Legacy reference:** React/Vite SPA and Node.js/Prisma server retained under `legacy:*` scripts
- **Testing:** Vitest, Playwright, Testing Library, axe-core (a11y); PHPUnit (Laravel)
- **Type system:** TypeScript for Next.js and shared client/core code; PHP typed controllers/services in Laravel.
- **Package manager:** pnpm 11 (workspace)

## Commands

### Dev
```bash
pnpm dev                    # canonical Laravel API + Next.js app
pnpm dev:next               # Next.js only
pnpm dev:laravel            # Laravel API only through Docker
pnpm dev:legacy             # legacy Vite SPA only
pnpm server                 # Laravel API via Docker (same as dev:laravel; NOT the legacy Node server)
pnpm server:legacy          # legacy Node.js/Prisma server only
```

### Build
```bash
pnpm build                  # canonical Next.js production build
pnpm build:next             # same as above
pnpm build:legacy           # legacy Vite SPA build
```

### Test & verify
```bash
pnpm verify                 # canonical cutover gate: API contract + core/Next typecheck + Next build + Laravel tests
pnpm verify:laravel-next:live # launches Laravel+Next and runs Playwright integration
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
pnpm verify:laravel
```
> On Git Bash (Windows), prefix the command with `MSYS_NO_PATHCONV=1` so the `-w /app/...` path isn't rewritten to a Windows path.

### Release gate
```bash
pnpm release:verify         # full verify + build + security check
```

## Notes

- Legacy SPA build modes remain under explicit `legacy` scripts only.
- The legacy Node server supports multiple storage backends and remains available for reference while route gaps are retired.
- AI SDK integrates Anthropic, OpenAI, Google, Groq, Mistral, OpenRouter
- The Laravel API uses short-lived bearer access tokens plus a `va_refresh` HttpOnly refresh cookie.
- Shared API contract source: `docs/api/archive-contract.openapi.json`
- Cutover record: `docs/laravel-nextjs-migration-plan.md`, `archive-laravel/ARCHIVE_MIGRATION.md`
