# archive-suite

pnpm monorepo for the Archive Suite. It has **canonical layers**:
- **Frontend (canonical):** `archive-next` — Next.js 16 + TypeScript (App Router)
- **Backend (canonical):** `archive-laravel` — Laravel 13 PHP API

New product work goes through the shared API contract, Laravel `/api/v1/*`, and Next.js routes. Frontend/backend sharing happens via `docs/api/archive-contract.openapi.json`, not a shared TypeScript package.

> Note: `archive-laravel` is a PHP project managed by Composer; it is **not** part of the pnpm workspace (`pnpm-workspace.yaml` lists `archive-next` only). The legacy `archive-app` (Vite SPA), `archive-server` (Node.js/Prisma server), and `archive-core` (shared TS library) packages were removed on 2026-07-12 and are recoverable from git history.

## Stack

- **Frontend:** Next.js 16 + TypeScript; React 19; App Router; RTL UI
- **Backend:** Laravel 13 PHP API with HttpOnly refresh-cookie auth, records/search/files/share/rights/media/ingest route groups
- **Testing:** Vitest, Playwright, Testing Library, axe-core (a11y); PHPUnit (Laravel)
- **Type system:** TypeScript for Next.js; PHP typed controllers/services in Laravel.
- **Package manager:** pnpm 11 (workspace)

## Commands

### Dev
```bash
pnpm dev                    # canonical Laravel API + Next.js app
pnpm dev:next               # Next.js only
pnpm dev:laravel            # Laravel API only through Docker
pnpm server                 # Laravel API via Docker (same as dev:laravel)
```

### Build
```bash
pnpm build                  # canonical Next.js production build
pnpm build:next             # same as above
```

### Test & verify
```bash
pnpm verify                 # canonical cutover gate: API contract + Next typecheck + Next build + Laravel tests
pnpm verify:laravel-next:live # launches Laravel+Next and runs Playwright integration
pnpm verify:api-contracts   # validate shared OpenAPI contract
pnpm typecheck              # typecheck Next.js
pnpm --filter @archive/next run test    # unit tests (vitest)
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

- AI SDK integrates Anthropic, OpenAI, Google, Groq, Mistral, OpenRouter
- The Laravel API uses short-lived bearer access tokens plus a `va_refresh` HttpOnly refresh cookie.
- Shared API contract source: `docs/api/archive-contract.openapi.json`
- Cutover record: `archive-laravel/ARCHIVE_MIGRATION.md`
