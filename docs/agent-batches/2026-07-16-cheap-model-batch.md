# Batch Runbook — cheap-model execution (2026-07-16)

Self-contained dispatch file. An executor model needs ONLY this file + the repo.
Do NOT load TASKS.md history; everything required is on each card.

## How to dispatch (operator)

One task card per session, cheapest model that can hold the card:

```bash
# per card, from repo root:
claude --model claude-haiku-4-5 -p "Execute task card V1-7XX from docs/agent-batches/2026-07-16-cheap-model-batch.md. Follow the Protocol section exactly."
```

Cards in GROUP C (contract-touching) must run **sequentially** (shared OpenAPI file).
Cards in GROUP U (UI-only) may run in parallel **only** if their file lists don't overlap.

## Step 0 — clean state (BLOCKING, do before any card)

Working tree has an uncommitted leftover batch. Commit it first as separate commits:

1. `fix(search): match keyword search against record content, not transport metadata` — `archive-laravel/app/Http/Controllers/Api/V1/SearchController.php` (+ run `SearchApiTest`)
2. `test: pin app.url in secure-cookie production guard test` — `archive-laravel/tests/Feature/ProductionHardeningTest.php`
3. `ci: make composer audit blocking; scope docker workflow paths and permissions` — `.github/workflows/ci.yml`, `.github/workflows/docker.yml`
4. `chore: pin typescript to 6.x` — `package.json`, `archive-next/package.json`, `pnpm-lock.yaml`, `archive-next/next-env.d.ts`
5. `docs(tasks): add V1-762 Dropbox integration item` — `TASKS.md`

Verify before committing groups 1–2: targeted Laravel tests (`SearchApiTest`, `ProductionHardeningTest`). Group 4: `pnpm typecheck`.

## Protocol (every card)

1. **TDD**: write the failing test first, run it RED, implement minimal GREEN, then refactor.
2. Touch ONLY the files listed on the card (+ its test files). If you believe another file must change, STOP and report instead of editing.
3. Any card that changes the API also updates `docs/api/archive-contract.openapi.json` **in the same commit** and runs `pnpm verify:api-contracts`.
4. Local gates per card (narrowest first):
   - Laravel: run the new test class alone, then the full suite once at the end of the card (`pnpm verify:laravel`).
   - Next: `pnpm --filter @archive/next run test`, then `pnpm typecheck`.
   - Do NOT run `pnpm verify` or builds per card — that is the batch owner's gate.
5. UI text is Arabic, RTL-aware; reuse existing components (`components/ui/*`) — check for an existing helper before writing one.
6. Write-access endpoints: `requireEditor()`/`requireAdmin()` per existing pattern in `Controller.php`; new routes must be added to `RouteScopeTest::FIXTURE` and `ROLE_FIXTURE` or the suite fails.
7. One commit per card: `feat|fix(scope): <description>`, then mark the card's TASKS.md line done (`- [x] ... (منجز 2026-MM-DD ...)`) and add one line in `ChangeLog.md`.
8. On completion, output: files changed, test counts (before/after), gate results. On failure/blockage: output what blocked you and change nothing else.

## GROUP C — contract batch (sequential, one owner)

### Card V1-713 — vocabulary CSV/JSON import/export with synonym merge
- **Goal**: `GET /api/v1/vocabulary/export?format=csv|json` and `POST /api/v1/vocabulary/import` (multipart file, same formats). Import merges synonyms into existing terms instead of duplicating; `?dryRun=1` returns the diff without writing.
- **First**: verify it does not already exist (`grep -n "vocabulary" archive-laravel/routes/api.php`). If export/import routes exist, report and stop.
- **Files**: `archive-laravel/app/Http/Controllers/Api/V1/VocabularyController.php`, `archive-laravel/routes/api.php`, `docs/api/archive-contract.openapi.json`, new test `archive-laravel/tests/Feature/Api/V1/VocabularyImportExportTest.php`.
- **RBAC**: export = any authenticated; import = `requireEditor()`.
- **Validation**: reject files > 5MB, unknown columns, malformed rows with 422 listing row numbers; never partial-write on validation failure (transaction).
- **Done**: RED→GREEN evidence, api-contracts clean, RouteScope fixtures updated.

### Card V1-714 — bulk record export/import via CSV
- **Goal**: `GET /api/v1/records/export?store=...` streams CSV of top-level record fields (uid, title, description, type, subtype, status, tags joined by `;`); `POST /api/v1/records/import` accepts the same CSV back, updates only rows whose uid exists, reports per-row accepted/rejected. `?dryRun=1` supported.
- **Files**: new `archive-laravel/app/Http/Controllers/Api/V1/RecordsBulkCsvController.php` (do NOT grow RecordsController), `archive-laravel/routes/api.php`, `docs/api/archive-contract.openapi.json`, new test `RecordsBulkCsvTest.php`.
- **RBAC**: export any authenticated; import `requireEditor()`.
- **Constraints**: records live in `storage_rows` (composite key `[store, uid]`, JSON `data`) accessed via `DB::table('storage_rows')` — follow the pattern in `TrashController`. Import must not create new uids (update-only) and must not touch fields absent from the CSV header.
- **Done**: RED→GREEN, api-contracts clean, fixtures updated, full Laravel suite green.

### Card V1-759 — API keys + webhooks for external automation
- **Goal**: admin-managed API keys (`POST/GET/DELETE /api/v1/api-keys` — token shown once, stored hashed) usable as `Authorization: Bearer` alternative with role ≤ editor; webhook subscriptions (`POST/GET/DELETE /api/v1/webhooks`; events: `record.created`, `record.updated`, `record.deleted`, `media_job.completed`, `media_job.failed`) delivered by a queued job with HMAC-SHA256 header `X-Archive-Signature`, 3 retries with backoff, auto-disable after 20 consecutive failures.
- **Files**: new controller(s) under `archive-laravel/app/Http/Controllers/Api/V1/`, new migration(s), `AuthenticateArchiveApiRequest` middleware (API-key acceptance), a queued `DeliverWebhook` job, `routes/api.php`, OpenAPI contract, tests (`ApiKeysTest`, `WebhooksTest`).
- **RBAC**: all management endpoints `requireAdmin()`.
- **Security**: never log or return the raw key/secret after creation; signature secret per subscription; outbound URL must be http(s) and must not resolve to loopback/private ranges (SSRF guard — reuse an existing pattern if present, else validate host).
- **Largest card — if context runs short, split: keys first (commit), webhooks second (commit).**

## GROUP U — UI-only batch (parallel-safe if file lists don't overlap)

Common: Vitest tests next to the component or in `archive-next/__tests__/`; run `pnpm --filter @archive/next run test` + `pnpm typecheck`.

### Card V1-748 — Shift+Click range select in archive grid
- **Files**: `archive-next/app/archive/page.tsx` (+ the selection helper if selection logic lives elsewhere — locate with `grep -rn "selected" archive-next/app/archive/`).
- **Behavior**: click sets anchor; shift+click selects the contiguous range in current visual order; ctrl/cmd+click keeps existing toggle behavior.

### Card V1-750 — right-click context menu on archive cards
- **Files**: archive card component (locate via `grep -rn "card" archive-next/app/archive/ archive-next/components/`); new `components/ui/ContextMenu.tsx` ONLY if a Radix context-menu isn't already available (`grep context-menu archive-next/package.json`).
- **Behavior**: فتح، فتح في تبويب جديد، تحديد، مشاركة، حذف — reuse the exact handlers the card's buttons already call; no new actions.

### Card V1-752 — persist sort/filter state per user across sessions
- **Files**: `archive-next/app/archive/page.tsx`, `archive-next/app/search/page.tsx`, new small `archive-next/lib/persisted-view-state.ts`.
- **Behavior**: persist to `localStorage` keyed by userId+page; URL params (existing behavior) win over stored state. Server-side per-user storage is out of scope — note it in the completion line.

### Card V1-753 — double-click inline rename on cards
- **Files**: archive card component + the existing record update call in `archive-next/lib/archive-api.ts` (do not add a new endpoint).
- **Behavior**: dblclick on title → input with current value; Enter saves via existing PATCH, Escape cancels; optimistic update with rollback + toast on failure.

### Card V1-777 — density toggle (comfortable/compact) for tables and grids
- **Files**: table/grid components (locate via `grep -rn "DataViewSwitcher" archive-next/`); density via a CSS-variable class on the container; persist choice via `lib/persisted-view-state.ts` from V1-752 — **run this card after V1-752**.
- **No layout re-implementation** — spacing via CSS variables only.

### Card V1-778 — status indicators not color-only
- **Files**: status badge component(s) (locate via `grep -rni "badge" archive-next/components/`).
- **Behavior**: add an icon or text shape per status alongside color; the existing axe spec (`archive-next/e2e/accessibility.spec.ts`) must stay green — this card must not add serious/critical findings.

### Card V1-779 — sticky action bar in long record forms
- **Files**: record edit form page (`archive-next/app/archive/[id]/`).
- **Behavior**: save/cancel bar becomes `position: sticky` at the bottom when the form overflows the viewport; respects RTL; CSS only — no JS scroll listeners.

### Card V1-781 — extend ContextualTips coverage to all classified pages
- **Files**: `archive-next/lib/contextual-tips.ts` + page wiring only.
- **Behavior**: add Arabic tips entries for pages currently lacking them; enumerate pages via `ls archive-next/app`; no new tip UI — the infrastructure exists.

## Out of batch (do NOT attempt with a cheap model)

- V1-762 Dropbox (OAuth + webhooks + streaming — needs a strong model and mock design)
- V1-732 undo/redo stack, V1-711 resumable chunked upload (architecture decisions)
- V1-303B..E, V1-307A..D (batch-5 gates, blocked until product batches finish)
- Anything marked "تحقق خارجي" (clean-host/field evidence)

## Batch close-out (owner, once all cards land)

`pnpm typecheck` + `pnpm verify:api-contracts` + `pnpm verify:laravel` + one `pnpm build:next`, then update the batch status in `TASKS.md`.
