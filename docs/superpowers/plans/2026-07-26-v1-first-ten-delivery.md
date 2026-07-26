# V1 First Ten Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the first ten approved V1 release-blocking tasks while preserving Laravel as domain owner and producing verifiable evidence.

**Architecture:** Deliver product and architecture work first, then the dependent quality and performance work. Public API changes are additive and move through OpenAPI, Laravel, generated bindings, and the Next client as one owned change. Evidence and benchmark artifacts stay outside the source tree and must be sanitized.

**Tech Stack:** Laravel/PHP, Next.js/React/TypeScript, OpenAPI, Vitest, Playwright, Docker, PostgreSQL, Dropbox SDK/Flysystem.

## Global Constraints

- Canonical code is `archive-next/` and `archive-laravel/`; never add new features to legacy packages.
- Run TDD for every behavior change and update `ChangeLog.md` plus `TASKS.md` only after real acceptance.
- Any public API change updates `docs/api/archive-contract.openapi.json`, Laravel, generated bindings, and `archive-next/lib/archive-api.ts` in the same change.
- Laravel owns domain state, scheduling, audit, transactions, and media-job status; Next never becomes a BFF.
- Never record a mock, local Docker run, or missing credential as a live external/clean-host/GPU acceptance pass.
- Do not start Tasks 7–10 before Tasks 1–6 have been accepted.

---

### Task 1: V1-795 — Mobile UI/UX audit

**Files:**
- Create: `docs/release/v1-795-ui-ux-mobile-audit.md`
- Modify: `TASKS.md`, `ChangeLog.md` only after acceptance
- Test: `archive-next/e2e/visual-regression.spec.ts`, `archive-next/e2e/visual-regression-authenticated.authed.spec.ts`

**Interfaces:** Uses `VIEWPORTS`, `ROUTE_COVERAGE`, and `assertNoClippedInteractiveElements` from `archive-next/e2e/fixtures/visual-routes.ts`. Produces a severity-ranked audit and new V1 IDs for nontrivial defects.

- [ ] **Step 1: Create the empty audit evidence structure**

```md
| Severity | Route | Viewport | Finding | Proposed fix | Evidence |
|---|---|---:|---|---|---|
```

- [ ] **Step 2: Run the existing public and authenticated visual suites at 375 and 768**

Run: `pnpm run e2e:next:visual` and the authenticated visual spec through `pnpm run verify:laravel-next:live`.

- [ ] **Step 3: Record every manual finding with one route, one viewport, and one proposed correction**

```md
| High | /archive | 375 | Primary bulk action is below the first scroll and visually indistinguishable | Promote one primary action and preserve secondary actions in overflow | sanitized screenshot path |
```

- [ ] **Step 4: Apply only deterministic single-line CSS fixes; otherwise add a separate V1 task**

- [ ] **Step 5: Re-run only affected visual scenarios and archive sanitized screenshots outside the repository**

- [ ] **Step 6: Commit and close V1-795 only when both viewports are reviewed**

### Task 2: V1-791 — Arabic language and RTL audit

**Files:**
- Modify: `archive-next/lib/arabic-terminology.ts`, `archive-next/lib/arabic-terminology.test.ts`, `docs/arabic-ui-glossary.md`
- Modify known copy owners: `archive-next/app/data-center/page.tsx`, `app/plugins/page.tsx`, `app/system/control/page.tsx`, `app/settings/page.tsx`, `app/search/page.tsx`, `app/media/review/page.tsx`, `app/kanban/page.tsx`, `app/reading-lists/page.tsx`
- Test: `archive-next/e2e/accessibility-authenticated.authed.spec.ts`

**Interfaces:** The terminology guard returns the path and invalid literal. Date-format normalization is deliberately owned by Task 8, so this task records but does not duplicate those changes.

- [ ] **Step 1: Add failing guard cases for known English operational literals**

```ts
expect(findForbiddenOperationalTerms(source)).toContain('Audit enforced')
```

- [ ] **Step 2: Replace each known literal with the glossary-approved Arabic copy and run the focused guard test**

- [ ] **Step 3: Inventory Laravel API messages; if stable error codes are absent, create a separate contract-backed V1 follow-up instead of translating raw messages in the client**

- [ ] **Step 4: Add Playwright assertions that Arabic-visible pages preserve `dir="rtl"` and documented LTR exceptions for technical identifiers**

- [ ] **Step 5: Run `pnpm typecheck`, `pnpm test:next`, affected Laravel tests, and the RTL/a11y scenario**

- [ ] **Step 6: Commit, document the audited routes, and close V1-791 only after the Laravel decision is verified**

### Task 3: V1-793 — In-app professional user guide

**Files:**
- Create: `archive-next/content/help/shared.md`, `archive-next/content/help/admin.md`, `archive-next/content/help/editor.md`, `archive-next/content/help/viewer.md`
- Create: `archive-next/lib/help-guide.ts`, `archive-next/lib/help-guide.test.ts`
- Modify: `archive-next/app/help/page.tsx`, `archive-next/lib/contextual-tips.ts`, `archive-next/components/ContextualTips.tsx`
- Test: `archive-next/e2e/help.spec.ts`

**Interfaces:** `getGuideEntries(role)` returns only permitted chapters; `searchGuide(query, role)` returns title, anchor, excerpt; `getGuideAnchor(pageKey)` maps a `PageKey` to a guide section.

- [ ] **Step 1: Write failing parser/search/role tests with Markdown fixtures**

```ts
expect(searchGuide('نسخة احتياطية', 'viewer')).toEqual([])
expect(getGuideAnchor('archive')).toBe('archive-daily-work')
```

- [ ] **Step 2: Implement a sanitized Markdown parser that rejects raw HTML and indexes headings/body text**

- [ ] **Step 3: Add role chapters for onboarding, archive work, administration, backup, and release notes**

- [ ] **Step 4: Replace the static help page with role filter, full-text search, chapter anchors, and a What’s New link**

- [ ] **Step 5: Add the contextual “كيف تعمل هذه الصفحة؟” link from each mapped tip to its guide anchor**

- [ ] **Step 6: Run Vitest, typecheck, build, and Playwright guide search/role visibility; commit and close V1-793**

### Task 4: V1-762 — Dropbox integration

**Files:**
- Create: `archive-laravel/app/Services/Dropbox/DropboxConnectionService.php`, `DropboxGateway.php`, `DropboxWebhookProcessor.php`
- Create migrations for encrypted connections, sync cursors, webhook deliveries, and dead letters
- Modify: `archive-laravel/config/filesystems.php`, `.env.example`, `routes/api.php`, `app/Http/Controllers/Api/V1/SystemController.php`, `docs/api/archive-contract.openapi.json`, `archive-next/lib/archive-api.ts`, `archive-next/app/settings/page.tsx`
- Test: Laravel feature tests for OAuth, storage, sync, webhook, retry; `archive-next/e2e/dropbox-settings.authed.spec.ts`

**Interfaces:** Connection state is encrypted at rest; gateway methods are `listFolder`, `uploadStream`, `downloadStream`, and `refreshAccessToken`; webhook delivery is idempotent on Dropbox event ID.

- [ ] **Step 1: Write failing Laravel tests for encrypted connection persistence and disabled-without-credentials behavior**

```php
$this->assertDatabaseHas('dropbox_connections', ['status' => 'connected']);
$this->assertStringNotContainsString($token, $row->encrypted_token);
```

- [ ] **Step 2: Add nullable encrypted persistence, OAuth state/PKCE validation, connect/disconnect/refresh endpoints, and additive OpenAPI schemas**

- [ ] **Step 3: Implement a mockable gateway with streaming retry/backoff and normalized quota/rate-limit errors**

- [ ] **Step 4: Add folder selection, cursor-based selective import, signed webhook deduplication, and dead-letter retry worker**

- [ ] **Step 5: Regenerate bindings; implement the Arabic settings/status UI and Playwright mock flow**

- [ ] **Step 6: Run contract checks, Laravel mocks, Next tests, and document V1-X01 as blocked until real Dropbox credentials and public webhook evidence exist**

### Task 5: V1-786 — Versioned media executor boundary

**Files:**
- Create: `archive-laravel/app/Services/Media/MediaJobPayload.php`, `MediaJobResult.php`, `MediaWorkerGateway.php`, `LocalMediaWorkerGateway.php`
- Modify: `app/Jobs/ProcessMediaWorkflow.php`, `app/Models/MediaJob.php`, `app/Providers/AppServiceProvider.php`, media-job migrations, OpenAPI, and Next bindings
- Test: `archive-laravel/tests/Feature/MediaJobsReliabilityTest.php`, `MediaJobsContainmentTest.php`, new gateway tests

**Interfaces:** `MediaWorkerGateway::execute(MediaJobPayload $payload): MediaJobResult`; Laravel alone leases, fences attempts, persists state, and validates signed idempotent callbacks.

- [ ] **Step 1: Write failing DTO/gateway tests covering version, idempotency key, attempt fence, cancel, and sanitized result**

- [ ] **Step 2: Add backwards-compatible nullable migration fields for executor/version/input manifest/output manifest/lease metadata and indexes**

- [ ] **Step 3: Wrap the existing `MediaProcessor` with `LocalMediaWorkerGateway` and keep `ProcessMediaWorkflow` as scheduler/state owner**

- [ ] **Step 4: Add optional remote CPU/GPU adapter, signed callback verification, and stale-attempt rejection behind an explicit configuration flag**

- [ ] **Step 5: Extend OpenAPI and Next types additively; do not break existing media-job requests**

- [ ] **Step 6: Run focused Laravel reliability/containment tests, contract checks, and document V1-X03 live GPU evidence separately**

### Task 6: V1-790 — Unified archive data access

**Files:**
- Create: `archive-laravel/app/Repositories/StorageRowRepository.php`, `tests/Unit/StorageRowRepositoryTest.php`
- Modify: `app/Models/StorageRow.php`, `app/Http/Controllers/Api/V1/RecordsController.php`, `SearchController.php`, `Services/Uploads/UploadFinalizer.php`
- Test: focused feature tests plus static raw-DB allowlist test

**Interfaces:** `find(string $store, string $uid)`, `upsert(string $store, string $uid, array $data)`, `delete(string $store, string $uid)`, and `transaction(Closure $callback)` preserve composite identity `[store, uid]`.

- [ ] **Step 1: Write repository tests for composite lookup, JSON casting, optimistic-version conflict, upsert, and transaction rollback**

- [ ] **Step 2: Correct the `StorageRow` composite-key behavior and implement the repository with scoped query builders**

- [ ] **Step 3: Migrate Records, Search, Types, and upload-finalization paths one owner at a time; preserve existing response contracts**

- [ ] **Step 4: Add JSON expression indexes only after an `EXPLAIN`/benchmark identifies a concrete predicate**

- [ ] **Step 5: Add a static allowlist test that fails new raw `storage_rows` calls outside the repository**

- [ ] **Step 6: Run Laravel tests and API contract checks; commit only after a migration/repository owner review**

### Task 7: V1-303D — Keyboard and screen-reader evidence

**Files:**
- Modify: `archive-next/e2e/keyboard-navigation.spec.ts`, `keyboard-navigation-authenticated.authed.spec.ts`
- Modify affected dialogs/toasts/upload/search components discovered by failing tests
- Create: `docs/release/v1-303d-screen-reader-evidence.md`

**Interfaces:** Tests verify focus enters dialogs, stays trapped, returns to trigger on Escape, and live regions announce async state without duplicate announcements.

- [ ] **Step 1: Add failing Playwright cases for dialog focus trap, Escape, focus return, and upload/search announcements**

```ts
await page.keyboard.press('Escape')
await expect(trigger).toBeFocused()
await expect(page.locator('[aria-live="polite"]')).toContainText('اكتمل')
```

- [ ] **Step 2: Fix only the component that violates the focused behavior and add stable aria labels/live regions**

- [ ] **Step 3: Run public and authenticated keyboard suites against live Laravel+Next**

- [ ] **Step 4: Perform the documented NVDA or VoiceOver sample on onboarding/archive/record/upload/search/admin and sanitize evidence**

- [ ] **Step 5: Commit evidence and close V1-303D only with passing automation plus human-reader proof**

### Task 8: V1-306B — RTL, dates, and operational text guard

**Files:**
- Create: `archive-next/lib/arabic-format.ts`, `archive-next/lib/arabic-format.test.ts`
- Modify: date consumers in `archive-next/app/rights`, `app/sync`, `app/reports`, `lib/scheduled-upload.ts`; terminology tests; RTL e2e tests

**Interfaces:** `formatArabicDate(value, options)` and `formatArabicNumber(value)` define the approved locale/calendar/number system; technical identifiers explicitly opt into `dir="ltr"`.

- [ ] **Step 1: Write failing formatter tests for one date and number contract used in every operational screen**

```ts
expect(formatArabicDate('2026-07-26')).toMatch(/٢٠٢٦|2026/)
expect(formatArabicNumber(1200)).not.toContain('1,200')
```

- [ ] **Step 2: Implement the formatter after recording the product decision for Arabic numerals/calendar**

- [ ] **Step 3: Replace ad-hoc `Intl`/`toLocaleDateString` calls in the audited routes and document native date-input behavior as an exception or replace it accessibly**

- [ ] **Step 4: Extend the terminology guard with an explicit allowlist and add RTL directional-icon assertions at 375/768/1280**

- [ ] **Step 5: Run typecheck, Next tests, live RTL/a11y suite; commit and close V1-306B**

### Task 9: V1-307B — Frontend performance baseline

**Files:**
- Create: `infra/platform/performance-baseline.v1.json`, `scripts/performance/frontend.mjs`, `scripts/performance/frontend.test.mjs`
- Modify: package scripts and release evidence documentation
- Test: runner unit tests and recorded baseline artifact

**Interfaces:** Resource contract includes CPU/RAM/browser/version/network; runner emits `{ route, viewport, samples, lcpP75, clsP75, inpP75, commit, datasetManifest }`.

- [ ] **Step 1: Write failing schema tests that reject reports missing resource contract, commit, dataset manifest, or p75 values**

- [ ] **Step 2: Define the versioned baseline contract and an ignored artifact directory outside the source tree**

- [ ] **Step 3: Implement Playwright/CDP sampling for daily routes and 375/768/1280 viewports**

- [ ] **Step 4: Compute p75 and compare to LCP ≤2.5s, CLS ≤0.1, INP ≤200ms without treating a non-baseline host as a pass**

- [ ] **Step 5: Generate the V1-307A deterministic dataset manifest, run the collector on the declared baseline, and save sanitized evidence**

- [ ] **Step 6: Commit runner/tests/evidence policy and close V1-307B only with baseline-host proof**

### Task 10: V1-307C — API and upload performance baseline

**Files:**
- Create: `scripts/performance/api.mjs`, `scripts/performance/api.test.mjs`, `docs/release/v1-307c-api-baseline.md`
- Modify: `infra/platform/performance-baseline.v1.json`, package scripts
- Test: runner unit tests and Docker/Native reports

**Interfaces:** Runner emits P95 for `search`, `recordOpen`, and `uploadSessionStart`; upload-session timing starts at request initiation and excludes transfer time.

- [ ] **Step 1: Write failing percentile and phase-timing tests**

```js
assert.equal(p95([10, 11, 12, 13, 100]), 100)
assert.equal(measurement.phase, 'upload-session-init')
```

- [ ] **Step 2: Implement deterministic authenticated scenarios against the V1-307A dataset for Docker and Native**

- [ ] **Step 3: Collect P95 search ≤1.5s, record open ≤1s, and upload-session start ≤2s with identical tool/data/resource contract**

- [ ] **Step 4: Classify a missing Native/baseline capability as `blocked-capability`; never label it passed from Docker alone**

- [ ] **Step 5: Save sanitized reports and compare Docker/Native inputs before publishing the baseline document**

- [ ] **Step 6: Run runner tests, focused Laravel checks, and close V1-307C only with both required evidence sets**

## Plan self-review

- Coverage: every approved V1 task appears once, and quality work is explicitly downstream of product/architecture work.
- External dependencies: Dropbox, GPU, Native, and baseline hardware have non-pass blocked states.
- Contract safety: all public API work includes OpenAPI, Laravel, bindings, and client requirements.
- No placeholder scan: no TBD/TODO markers or undefined implementation phases are present.
