# Application Localization, Help, and User Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver account-persisted Arabic and English application localization, a language-aware Help center, and a complete role-filtered user guide.

**Architecture:** Laravel stores a nullable `ar|en` account preference and exposes it through the shared user contract. Next.js resolves the request locale, renders through typed feature dictionaries, and reconciles the authenticated account preference. Help reads one authorized locale-specific Markdown file per chapter and renders it with a safe GFM renderer.

**Tech Stack:** Laravel 13, PHP 8.5, OpenAPI 3.1, Next.js 16 App Router, React 19, TypeScript 6, Vitest, PHPUnit, Playwright, `react-markdown`, and `remark-gfm`.

## Global Constraints

- Supported locales are exactly `ar` and `en`; account locale remains nullable until explicitly selected.
- Locale precedence after authentication is account, cookie, browser, then Arabic fallback.
- Public URLs do not gain locale prefixes.
- Arabic copy must be natural Modern Standard Arabic; technical identifiers remain unchanged.
- User data is never machine-translated.
- English stays gated until every supported route passes localization coverage.
- API changes update OpenAPI, Laravel, the Next.js client, and contract tests together.
- Guide authorization happens before any chapter body is read.

---

## Phase A — Locale foundation and account preference

### Task 1: Persist the account locale and publish it in the API contract

**Files:**
- Create: `archive-laravel/database/migrations/2026_08_08_000000_add_locale_to_users_table.php`
- Create: `archive-laravel/app/Http/Requests/UpdateAccountPreferencesRequest.php`
- Modify: `archive-laravel/app/Models/User.php`
- Modify: `archive-laravel/app/Http/Controllers/Api/V1/AuthController.php`
- Modify: `archive-laravel/app/Http/Middleware/AuditArchiveApiRequest.php`
- Modify: `archive-laravel/routes/api.php`
- Modify: `docs/api/archive-contract.openapi.json`
- Test: `archive-laravel/tests/Feature/AccountPreferencesApiTest.php`

**Interfaces:**
- Produces: nullable `User.locale: "ar" | "en" | null`.
- Produces: authenticated `PATCH /api/v1/account/preferences` with `{ locale }`.

- [ ] **Step 1: Write the failing Laravel feature tests**

```php
public function test_user_can_update_own_locale(): void
{
    $user = User::factory()->create(['locale' => null]);
    $response = $this->actingAs($user)->patchJson('/api/v1/account/preferences', ['locale' => 'en']);
    $response->assertOk()->assertJsonPath('user.locale', 'en');
    $this->assertDatabaseHas('users', ['id' => $user->id, 'locale' => 'en']);
}

public function test_locale_rejects_unknown_values(): void
{
    $user = User::factory()->create();
    $this->actingAs($user)
        ->patchJson('/api/v1/account/preferences', ['locale' => 'fr'])
        ->assertUnprocessable();
}
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node scripts/laravel-docker.mjs test --filter=AccountPreferencesApiTest`
Expected: FAIL because the route and `locale` column do not exist.

- [ ] **Step 3: Add the migration, request, controller action, and route**

The request rules are:

```php
public function rules(): array
{
    return ['locale' => ['required', 'string', Rule::in(['ar', 'en'])]];
}
```

`AuthController::preferences()` updates only `$request->attributes->get('archive_user')`, saves the locale, and returns `['ok' => true, 'user' => $this->formatUser($user->refresh())]`. Add `locale` to the shared formatter and to `User` fillable attributes.

Map `PATCH /api/v1/account/preferences` to a dedicated `account.preferences.update` audit action without recording the submitted locale as free-form metadata.

- [ ] **Step 4: Extend OpenAPI with `AccountPreferencesRequest`, `AccountPreferencesResponse`, the route, and nullable `User.locale`**

- [ ] **Step 5: Run contract generation and focused tests**

Run: `pnpm api:generate && pnpm verify:api-contracts && pnpm verify:api-generated && node scripts/laravel-docker.mjs test --filter=AccountPreferencesApiTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add archive-laravel docs/api archive-next/lib/archive-api.ts
git commit -m "feat(i18n): persist account locale"
```

### Task 2: Build locale resolution and typed dictionaries

**Files:**
- Create: `archive-next/lib/i18n/types.ts`
- Create: `archive-next/lib/i18n/resolve-locale.ts`
- Create: `archive-next/lib/i18n/dictionaries/ar/shared.ts`
- Create: `archive-next/lib/i18n/dictionaries/en/shared.ts`
- Create: `archive-next/lib/i18n/dictionaries/index.ts`
- Test: `archive-next/lib/i18n/resolve-locale.test.ts`
- Test: `archive-next/lib/i18n/dictionaries.test.ts`

**Interfaces:**
- Produces: `type AppLocale = "ar" | "en"`.
- Produces: `resolveRequestLocale(input): AppLocale` and `directionFor(locale): "rtl" | "ltr"`.
- Produces: `getDictionary(locale)` with compile-time Arabic/English key parity.

- [ ] **Step 1: Write failing precedence and parity tests**

```ts
expect(resolveRequestLocale({ cookie: "en", acceptLanguage: "ar-SA", fallback: "ar" })).toBe("en");
expect(resolveRequestLocale({ cookie: null, acceptLanguage: "en-US,en;q=0.9", fallback: "ar" })).toBe("en");
expect(resolveRequestLocale({ cookie: "fr", acceptLanguage: "fr", fallback: "ar" })).toBe("ar");
expect(Object.keys(dictionaries.ar.shared)).toEqual(Object.keys(dictionaries.en.shared));
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm --filter @archive/next exec vitest run lib/i18n/resolve-locale.test.ts lib/i18n/dictionaries.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement strict locale parsing, `Accept-Language` parsing, direction, and typed shared dictionaries**

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @archive/next exec vitest run lib/i18n/resolve-locale.test.ts lib/i18n/dictionaries.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add archive-next/lib/i18n
git commit -m "feat(i18n): add typed locale runtime"
```

### Task 3: Apply locale before rendering and reconcile the session

**Files:**
- Create: `archive-next/lib/i18n/LocaleProvider.tsx`
- Create: `archive-next/lib/i18n/LocaleAccountSync.tsx`
- Modify: `archive-next/proxy.ts`
- Modify: `archive-next/app/layout.tsx`
- Modify: `archive-next/components/AppProviders.tsx`
- Modify: `archive-next/lib/auth-session.tsx`
- Test: `archive-next/lib/i18n/LocaleProvider.test.tsx`
- Test: `archive-next/lib/rtl-contract.test.ts`

**Interfaces:**
- Produces: `useLocale(): { locale, direction, t, setLocale }`.
- Consumes: `ArchiveUser.locale` from Task 1.

- [ ] **Step 1: Write failing provider and document-direction tests**

Test immediate `ar → en` switching, cookie persistence, invalid stored values, account reconciliation, and `lang=en dir=ltr` output.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `pnpm --filter @archive/next exec vitest run lib/i18n/LocaleProvider.test.tsx lib/rtl-contract.test.ts`

- [ ] **Step 3: Implement `LocaleProvider`, account sync, proxy request header, and request-aware root layout**

Use cookie name `archive_locale`, request header `x-archive-locale`, and local recovery key `archive.locale`. Provider order becomes `LocaleProvider > AuthProvider > LocaleAccountSync > AuthGate`.

- [ ] **Step 4: Replace AuthGate loading, redirect, logout, and session-expiry literals with `shared`/`auth` keys**

- [ ] **Step 5: Run focused tests, typecheck, and build**

Run: `pnpm --filter @archive/next exec vitest run lib/i18n/LocaleProvider.test.tsx lib/rtl-contract.test.ts && pnpm typecheck && pnpm build:next`
Expected: PASS with Arabic and English document-direction assertions.

- [ ] **Step 6: Commit**

```bash
git add archive-next/app/layout.tsx archive-next/proxy.ts archive-next/components/AppProviders.tsx archive-next/lib/auth-session.tsx archive-next/lib/i18n
git commit -m "feat(i18n): apply account locale across sessions"
```

### Task 4: Make Settings language selection transactional

**Files:**
- Create: `archive-next/components/LanguageSettings.tsx`
- Modify: `archive-next/app/settings/page.tsx`
- Modify: `archive-next/lib/archive-api.ts`
- Test: `archive-next/components/LanguageSettings.test.tsx`

**Interfaces:**
- Consumes: `api.updateAccountPreferences({ locale })` and `useLocale()`.
- Produces: accessible Arabic/English selector with rollback on API failure.

- [ ] **Step 1: Write tests for success, keyboard labels, pending state, and rollback**

```ts
fireEvent.change(screen.getByLabelText("لغة الواجهة"), { target: { value: "en" } });
await waitFor(() => expect(api.updateAccountPreferences).toHaveBeenCalledWith({ locale: "en" }));
expect(screen.getByRole("status")).toHaveTextContent("Language updated");
```

- [ ] **Step 2: Confirm RED, implement the API client and component, then run GREEN**

Run: `pnpm --filter @archive/next exec vitest run components/LanguageSettings.test.tsx`
Expected before implementation: FAIL; after implementation: PASS.

- [ ] **Step 3: Remove the read-only “اللغة: العربية” card and render `LanguageSettings`**

- [ ] **Step 4: Run typecheck and settings tests**

Run: `pnpm typecheck && pnpm --filter @archive/next exec vitest run components/LanguageSettings.test.tsx app/settings`

- [ ] **Step 5: Commit**

```bash
git add archive-next/app/settings archive-next/components/LanguageSettings.tsx archive-next/lib/archive-api.ts
git commit -m "feat(settings): persist interface language"
```

---

## Phase B — Localized Help and user guide

### Task 5: Make guide loading locale-aware and authorization-first

**Files:**
- Modify: `archive-next/lib/in-app-guide.ts`
- Modify: `archive-next/lib/guide-content.ts`
- Modify: `archive-next/app/api/guide/route.ts`
- Modify: `archive-next/app/api/guide/route.test.ts`
- Modify: `archive-next/lib/in-app-guide.test.ts`

**Interfaces:**
- Produces: `getGuideChapters(role: GuideRole, locale: AppLocale)`.
- Produces: `GuideChapter` with localized `title`, `body`, and one authorized locale.

- [ ] **Step 1: Write failing tests proving role filtering happens before `readFileSync` and only one locale is returned**

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `pnpm --filter @archive/next exec vitest run lib/in-app-guide.test.ts app/api/guide/route.test.ts`

- [ ] **Step 3: Change the manifest to `{ sourceStem, titles: { ar, en } }`, filter entries by role, then read `${stem}.${locale === "ar" ? "ar.md" : "md"}`**

- [ ] **Step 4: Make `/api/guide` use account locale, then validated query locale only for a null account locale**

- [ ] **Step 5: Run tests and commit**

```bash
git add archive-next/lib/guide-content.ts archive-next/lib/in-app-guide.ts archive-next/app/api/guide
git commit -m "feat(help): localize authorized guide payloads"
```

### Task 6: Replace the Markdown parser with a safe GFM renderer

**Files:**
- Modify: `archive-next/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `archive-next/components/GuideMarkdown.tsx`
- Modify: `archive-next/components/GuideBrowser.tsx`
- Test: `archive-next/components/GuideMarkdown.test.tsx`
- Modify: `archive-next/components/GuideBrowser.test.tsx`

**Interfaces:**
- Produces: `<GuideMarkdown body locale />` with no raw HTML.

- [ ] **Step 1: Add failing tests for headings, code, tables, safe links, blocked `javascript:` links, and ignored raw HTML**

- [ ] **Step 2: Install `react-markdown` and `remark-gfm`**

Run: `pnpm install --filter @archive/next react-markdown remark-gfm`

- [ ] **Step 3: Implement `GuideMarkdown` with explicit component overrides and no `rehype-raw`**

Relative links must begin with `/`; external links must use `https:` and add `rel="noreferrer"`.

- [ ] **Step 4: Replace `markdownToSections`, localize browser labels, and focus the selected H2**

- [ ] **Step 5: Run tests and commit**

```bash
git add archive-next/package.json pnpm-lock.yaml archive-next/components/GuideMarkdown.tsx archive-next/components/GuideMarkdown.test.tsx archive-next/components/GuideBrowser.tsx archive-next/components/GuideBrowser.test.tsx
git commit -m "feat(help): render localized guide markdown safely"
```

### Task 7: Publish the complete bilingual role-aware user guide

**Files:**
- Rename Arabic files under: `archive-next/content/guide/*.md` to `*.ar.md`
- Create English and Arabic chapter pairs under: `archive-next/content/guide/`
- Modify: `archive-next/app/help/page.tsx`
- Modify: `archive-next/lib/guide-content.ts`
- Test: `archive-next/lib/in-app-guide.test.ts`
- Test: `archive-next/components/GuideBrowser.test.tsx`

**Interfaces:**
- Produces: eleven chapter families defined in the approved spec.

- [ ] **Step 1: Add manifest tests requiring every source stem to have `.md` and `.ar.md`, a routable destination, and non-empty outcome/procedure/verification sections**

- [ ] **Step 2: Confirm RED**

Run: `pnpm --filter @archive/next exec vitest run lib/in-app-guide.test.ts`

- [ ] **Step 3: Author natural Arabic and English pairs for getting started, search, files, rights, uploads, collaboration, media, users, integrations, operations, and current release changes**

Every pair uses `## Outcome`, `## Prerequisites`, `## Procedure`, `## Verify`, and where applicable `## Safety`; Arabic uses equivalent natural headings.

- [ ] **Step 4: Rebuild `/help` around localized onboarding, guide search, role label, and support links; remove raw route and command prose from the checklist**

- [ ] **Step 5: Run guide, accessibility, and responsive tests**

Run: `pnpm --filter @archive/next exec vitest run lib/in-app-guide.test.ts components/GuideBrowser.test.tsx lib/responsive-layout.test.ts`

- [ ] **Step 6: Commit**

```bash
git add archive-next/content/guide archive-next/app/help archive-next/lib/guide-content.ts archive-next/lib/in-app-guide.test.ts archive-next/components/GuideBrowser.test.tsx
git commit -m "docs(help): publish bilingual role-aware user guide"
```

---

## Phase C — Whole-application localization and release gate

### Task 8: Localize the global shell, navigation, authentication, dialogs, and notifications

**Files:**
- Modify: `archive-next/components/AppShell.tsx`
- Modify: `archive-next/components/AppHeader.tsx`
- Modify: `archive-next/components/CommandPalette.tsx`
- Modify: `archive-next/lib/navigation.ts`
- Modify: `archive-next/app/login/page.tsx`
- Modify: `archive-next/components/ui/ConfirmDialog.tsx`
- Modify: `archive-next/components/ui/Toast*.tsx`
- Create/Modify: `archive-next/lib/i18n/dictionaries/{ar,en}/{shell,auth,shared}.ts`

- [ ] **Step 1: Add failing component tests rendering the shell and login in both locales**
- [ ] **Step 2: Replace visible literals with typed keys and locale-aware navigation records**
- [ ] **Step 3: Run shell/auth tests, typecheck, and commit**

```bash
git add archive-next/components archive-next/app/login archive-next/lib/navigation.ts archive-next/lib/i18n/dictionaries
git commit -m "feat(i18n): localize application shell"
```

### Task 9: Localize archive, search, records, files, uploads, and rights

**Files:**
- Modify route trees: `archive-next/app/archive/`, `search/`, `files/`, `uploads/`, `rights/`, `shares/`, `share/`
- Create/Modify dictionaries: `archive`, `search`, `files`, `rights`
- Modify affected tests alongside each route.

- [ ] **Step 1: Add locale matrix helpers that render each route in `ar` and `en`**
- [ ] **Step 2: Move visible labels, empty states, validation, table headers, actions, and status copy into typed dictionaries**
- [ ] **Step 3: Replace hard-coded `"ar"` sorting/formatting with active locale formatting**
- [ ] **Step 4: Run affected route tests and commit**

```bash
git add archive-next/app/archive archive-next/app/search archive-next/app/files archive-next/app/uploads archive-next/app/rights archive-next/app/shares archive-next/app/share archive-next/lib/i18n
git commit -m "feat(i18n): localize archive workflows"
```

### Task 10: Localize collaboration, media, automation, and remaining operational routes

**Files:**
- Modify route trees: `collections/`, `projects/`, `project-*`, `collaboration/`, `media/`, `automation/`, `reports/`, `errors/`, `status/`, `backup/`, `system/`, `settings/`, and remaining `archive-next/app/**/page.tsx`.
- Create/Modify dictionaries: `collaboration`, `media`, `operations`, `settings`.

- [ ] **Step 1: Generate a tracked route inventory from `archive-next/app/**/page.tsx` and fail when a supported route lacks a localization namespace**
- [ ] **Step 2: Localize every inventory entry, including tooltips, ARIA labels, loading, empty, success, warning, and error states**
- [ ] **Step 3: Use machine error codes for localized client messages; unknown codes use the localized generic message plus request ID**
- [ ] **Step 4: Run all Next tests and commit**

```bash
git add archive-next/app archive-next/components archive-next/lib/i18n
git commit -m "feat(i18n): localize remaining application routes"
```

### Task 11: Add localization completeness, direction, and browser journeys

**Files:**
- Create: `scripts/verify-next-localization.mjs`
- Create: `scripts/verify-next-localization.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create: `archive-next/e2e/localization.spec.ts`
- Modify: `archive-next/e2e/visual-regression.spec.ts`

**Interfaces:**
- Produces: `pnpm verify:localization`.

- [ ] **Step 1: Write failing gate tests for dictionary parity, route inventory coverage, guide pairs, and forbidden raw visible literals**
- [ ] **Step 2: Implement the verifier and add it to `verify:laravel-next` and CI**
- [ ] **Step 3: Add Playwright journeys for browser detection, account precedence, Settings switching, reload persistence, RTL/LTR, and role-isolated guide content**
- [ ] **Step 4: Add Arabic and English visual snapshots at 375, 768, and 1280 pixels**
- [ ] **Step 5: Run the complete gate**

Run: `pnpm verify:localization && pnpm verify:public-docs && pnpm typecheck && pnpm test:next && pnpm build:next && pnpm verify:laravel`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-next-localization.mjs scripts/verify-next-localization.test.mjs package.json .github/workflows/ci.yml archive-next/e2e
git commit -m "test(i18n): gate complete bilingual coverage"
```

### Task 12: Final documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `README.ar.md`
- Modify: `docs/features-guide.md`
- Modify: `docs/features-guide.ar.md`
- Modify: `docs/public-docs.manifest.json`
- Modify: `docs/public-writing-style.md`
- Modify: `docs/public-writing-style.ar.md`

- [ ] **Step 1: Document account language selection, browser fallback, RTL/LTR behavior, and Help chapter roles in both languages**
- [ ] **Step 2: Run public documentation validation and full project verification**

Run: `pnpm verify:public-docs && pnpm verify`
Expected: PASS.

- [ ] **Step 3: Confirm the English selector is no longer gated and no internal delivery notes appear in Help or public docs**

- [ ] **Step 4: Commit**

```bash
git add README.md README.ar.md docs
git commit -m "docs: publish bilingual application user guide"
```
