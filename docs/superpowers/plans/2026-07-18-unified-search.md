# Unified Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver accessible Arabic-first search with time-coded transcript matches, semantic search, autocomplete, and private/read-only shared saved searches.

**Architecture:** Laravel remains the search, authorization, transcript parsing, and saved-search source of truth. Next.js expands the existing `/search` route and routes time-coded matches to the existing media player. Search-specific components keep page state, combobox behavior, and query construction separate.

**Tech Stack:** Laravel, SQLite feature tests, OpenAPI JSON, Next.js App Router, React 19, TypeScript, Vitest.

## Global Constraints

- Change only the canonical Laravel + Next.js path.
- Update OpenAPI and `archive-next/lib/archive-api.ts` in the same commit for every API change.
- Never expose a record, transcript cue, or suggestion without existing Laravel read authorization.
- Semantic failures return existing keyword results with an explicit mode indicator.
- A time jump requires a non-negative timestamp parsed from a VTT/SRT cue.

---

## File Structure

- `archive-laravel/app/Services/Search/TranscriptSearchService.php`: parse VTT/SRT and find matching cues.
- `archive-laravel/app/Services/Search/SearchSuggestionService.php`: bounded record/tag/type suggestions.
- `archive-laravel/app/Http/Controllers/Api/V1/SearchSuggestionsController.php`: authenticated suggestion endpoint.
- `archive-laravel/app/Http/Controllers/Api/V1/SearchController.php`: selected mode and transcript result shaping.
- `archive-laravel/app/Http/Controllers/Api/V1/SavedSearchesController.php`: private/shared lifecycle.
- `archive-next/lib/search.ts`: deep-link and mode helpers.
- `archive-next/components/SearchAutocomplete.tsx`: accessible cancellable combobox.
- `archive-next/components/SearchFilterBuilder.tsx`: visual advanced-query builder.
- `archive-next/app/search/page.tsx`: compositional search interface.
- `archive-next/components/MediaPlayer.tsx`: safe initial-time seeking.
- `archive-next/app/search/saved/page.tsx`: shared saved-search management.

## Task 1: Add timed transcript results and contract

**Files:**
- Create: `archive-laravel/app/Services/Search/TranscriptSearchService.php`
- Modify: `archive-laravel/app/Http/Controllers/Api/V1/SearchController.php`
- Modify: `archive-laravel/tests/Feature/SearchApiTest.php`
- Modify: `docs/api/archive-contract.openapi.json`
- Modify: `archive-next/lib/archive-api.ts`

**Produces:** `SearchMatch { kind: "metadata" | "semantic" | "transcript"; excerpt?: string; timestampSeconds?: number }` on every time-coded result.

- [ ] Write a failing feature test that posts a record whose `transcript` is VTT containing `00:01:23.000 --> 00:01:27.000` and asserts `GET /api/v1/search?mode=transcript&q=<Arabic term>` returns `match.kind === "transcript"` and `timestampSeconds === 83`.
- [ ] Run `docker compose -f archive-laravel/docker-compose.yml exec -T app php artisan test --filter=SearchApiTest`; confirm failure because `mode` and `match` are absent.
- [ ] Add `TranscriptSearchService::find(string $transcript, string $query): array` which parses VTT/SRT cue start times, normalizes text, returns the first matching cue as `["excerpt" => ..., "timestampSeconds" => ...]`, and returns an empty array for untimed/plain transcripts. Validate `mode` as `keyword|semantic|transcript`, with 422 for other values.
- [ ] Extend `SearchFacets.mode` and `SearchResponse` in OpenAPI, then add matching client types.
- [ ] Re-run the focused Laravel test and `pnpm verify:api-contracts`; expect PASS.
- [ ] Commit: `git commit -m "feat(search): add timed transcript results"`.

## Task 2: Link transcript results to the player and expose search modes

**Files:**
- Create: `archive-next/lib/search.ts`, `archive-next/lib/search.test.ts`
- Modify: `archive-next/components/MediaPlayer.tsx`
- Modify: `archive-next/app/media/play/page.tsx`
- Modify: `archive-next/app/search/page.tsx`
- Modify: `archive-next/app/styles/04-tables.css`

**Produces:** `buildSearchPlaybackHref(record, seconds): string | null` and `MediaPlayerProps.initialTime?: number`.

- [ ] Write failing tests: a record with `deriveRecordSourcePath` and `83` produces a `/media/play?...&at=83` URL; a no-file record produces `null`.
- [ ] Run `pnpm --filter @archive/next test -- lib/search.test.ts`; confirm RED.
- [ ] Add the helper using `deriveRecordSourcePath` and `URLSearchParams`; parse `at` in media-play. On `loadedmetadata`, seek once to the finite non-negative initial time and focus the media element without autoplay.
- [ ] Add the Arabic mode selector (عادي/دلالي/داخل التفريغات), include mode in URLs/API requests, show a time/excerpt/reason and a “تشغيل من …” button only for timed matches. Retain detail opening for ordinary results.
- [ ] Run the helper tests and `pnpm typecheck`; expect PASS.
- [ ] Commit: `git commit -m "feat(search): add timed playback controls"`.

## Task 3: Add semantic UI and visual advanced filters

**Files:**
- Create: `archive-next/components/SearchFilterBuilder.tsx`, `archive-next/components/SearchFilterBuilder.test.tsx`
- Modify: `archive-next/app/search/page.tsx`, `archive-next/app/styles/04-tables.css`

**Produces:** a visual builder that appends a valid advanced predicate without rewriting existing expert query text.

- [ ] Write a failing component test: selecting `tag`, entering `تاريخ شفهي`, and clicking “إضافة فلتر” invokes `onChange("history AND tag:\\"تاريخ شفهي\\")`.
- [ ] Run `pnpm --filter @archive/next test -- components/SearchFilterBuilder.test.tsx`; confirm RED.
- [ ] Implement fixed choices `title|description|type|subtype|tag|store|status|uid`; quote whitespace values and append with `AND`. For semantic selection, show a dismissible Arabic fallback banner exclusively when API facets report `keyword-fallback`.
- [ ] Run the component test and `pnpm typecheck`; expect PASS.
- [ ] Commit: `git commit -m "feat(search): expose semantic and visual filters"`.

## Task 4: Add autocomplete

**Files:**
- Create: `archive-laravel/app/Services/Search/SearchSuggestionService.php`, `archive-laravel/app/Http/Controllers/Api/V1/SearchSuggestionsController.php`
- Create: `archive-next/components/SearchAutocomplete.tsx`, `archive-next/components/SearchAutocomplete.test.tsx`
- Modify: `archive-laravel/routes/api.php`, `archive-laravel/tests/Feature/SearchApiTest.php`, `docs/api/archive-contract.openapi.json`, `archive-next/lib/archive-api.ts`, `archive-next/app/search/page.tsx`

**Produces:** `GET /search/suggestions?q=&limit=8` with `SearchSuggestion { kind: "record" | "tag" | "type" | "recent"; label: string; value: string; recordId?: string }`.

- [ ] Write failing endpoint test for a matching record and component test for combobox ArrowDown/Enter selection.
- [ ] Run the component test; confirm RED.
- [ ] Validate 2–120-character `q`, 1–8 `limit`, return only records in the authenticated search scope plus distinct matching tags/types. In the client debounce 180ms, cancel previous request with `AbortController`, use combobox/listbox/option roles, and close on Escape/blur.
- [ ] Run `pnpm verify:api-contracts` and the focused component test; expect PASS.
- [ ] Commit: `git commit -m "feat(search): add accessible autocomplete"`.

## Task 5: Add private/read-only shared saved searches

**Files:**
- Create: `archive-laravel/database/migrations/2026_07_18_000001_add_sharing_to_saved_searches_table.php`
- Modify: `archive-laravel/app/Http/Controllers/Api/V1/SavedSearchesController.php`, `archive-laravel/routes/api.php`, `archive-laravel/tests/Feature/SavedSearchesApiTest.php`, `docs/api/archive-contract.openapi.json`, `archive-next/lib/archive-api.ts`, `archive-next/app/search/saved/page.tsx`

**Produces:** `SavedSearch { ownerId, shared, canManage }`, `PATCH /saved-searches/{id}` for owners/admins, and `POST /saved-searches/{id}/copy`.

- [ ] Write failing feature tests that an owner shares a search, a second user lists/runs but cannot patch it, and the second user copies it as private.
- [ ] Run `docker compose -f archive-laravel/docker-compose.yml exec -T app php artisan test --filter=SavedSearchesApiTest`; confirm RED.
- [ ] Add nullable indexed `shared_at`. List caller-owned plus shared entries; set `canManage` only for owner/admin. Permit owner/admin sharing changes and deletion; copying creates an unshared entry owned by the caller. Persist mode and view preference in the existing filters JSON.
- [ ] In the saved-search page label private/shared entries, provide owner/admin sharing actions, and restrict other users to Run/Copy.
- [ ] Run contract checks, focused Laravel tests, and `pnpm typecheck`; expect PASS.
- [ ] Commit: `git commit -m "feat(search): add read-only team sharing"`.

## Task 6: Integrate and close the delivery ledger

**Files:**
- Modify: `TASKS.md`, `ChangeLog.md`

- [ ] Run `pnpm test:next`, `pnpm verify:api-contracts`, `pnpm typecheck`, `pnpm build:next`, and `pnpm verify:laravel`.
- [ ] Run `pnpm verify:laravel-next:live` if the local Docker/API environment is available.
- [ ] Only after all applicable checks pass, mark V1-705 complete and add a concise ChangeLog entry naming timed transcript search, semantic fallback UI, autocomplete, and private/read-only sharing.
- [ ] Commit: `git commit -m "docs(tasks): close unified search delivery"`.

