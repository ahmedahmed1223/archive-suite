# Shared Shell Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared authenticated workspace chrome follow the account language so Help is not surrounded by Arabic-only controls when English is selected.

**Architecture:** Extend the existing typed `LocaleProvider` dictionary with a `shell` namespace. Shared components read that namespace and translate navigation labels through a locale-aware navigation projection, while route URLs and technical identifiers remain unchanged. Existing page-specific content stays independent of the shared shell so each page can migrate without changing its routes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, Playwright CLI.

## Global Constraints

- Arabic is the default language; English copy must be natural rather than literal.
- Locale comes from the account preference and is applied by `LocaleProvider`.
- Preserve Arabic strings for `ar`, technical routes, role values, and keyboard shortcuts.
- Do not expose internal release work in user-visible copy.

---

### Task 1: Localize shared shell copy

**Files:**
- Modify: `archive-next/lib/i18n/dictionaries/ar/shell.ts`
- Create: `archive-next/lib/i18n/dictionaries/en/shell.ts`
- Modify: `archive-next/lib/i18n/dictionaries/index.ts`
- Modify: `archive-next/lib/i18n/dictionaries.test.ts`

**Interfaces:**
- Produces `t.shell` with labels used by `AppShell`, `AppHeader`, `WorkspaceCommandBar`, and `OnboardingPrompt`.

- [ ] **Step 1: Write failing dictionary parity and English-copy tests**

```ts
expect(getDictionary("en").shell.skipToContent).toBe("Skip to main content");
expect(getDictionary("ar").shell.onboardingTitle).toBe("هل هذا أول تشغيل؟");
```

- [ ] **Step 2: Run the focused test and verify it fails because `shell` is missing**

Run: `pnpm test -- lib/i18n/dictionaries.test.ts`

- [ ] **Step 3: Add matched Arabic and English `shell` dictionaries and register them**

```ts
export const shell = { skipToContent: "Skip to main content", onboardingTitle: "Is this your first time here?" } as const;
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm test -- lib/i18n/dictionaries.test.ts`

### Task 2: Localize the authenticated help shell

**Files:**
- Modify: `archive-next/components/AppShell.tsx`
- Modify: `archive-next/components/AppHeader.tsx`
- Modify: `archive-next/components/WorkspaceCommandBar.tsx`
- Modify: `archive-next/components/OnboardingPrompt.tsx`
- Test: `archive-next/components/AppHeader.test.tsx`
- Test: `archive-next/components/WorkspaceCommandBar.test.tsx`
- Test: `archive-next/components/FirstRunTour.test.tsx`

**Interfaces:**
- Consumes `useLocale(): { locale, t }`.
- Produces locale-specific accessible names, navigation controls, command-bar labels, and onboarding prompt labels.

- [ ] **Step 1: Write failing component tests under `LocaleProvider initialLocale="en"`**

```tsx
expect(screen.getByRole("link", { name: /skip to main content/i })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Search, open a page, or run a command" })).toBeInTheDocument();
expect(screen.getByText("Is this your first time here?")).toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and verify they fail on Arabic-only labels**

Run: `pnpm test -- components/AppHeader.test.tsx components/WorkspaceCommandBar.test.tsx components/FirstRunTour.test.tsx`

- [ ] **Step 3: Replace shared hard-coded labels with `t.shell` values**

```tsx
const { t } = useLocale();
<a className="skip-link" href="#main-content">{t.shell.skipToContent}</a>
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm test -- components/AppHeader.test.tsx components/WorkspaceCommandBar.test.tsx components/FirstRunTour.test.tsx`

### Task 3: Verify live language switching on Help

**Files:**
- Test: `archive-next/app/help/page.test.tsx`

**Interfaces:**
- Consumes the shared shell localization from Tasks 1–2.
- Produces an English Help experience with no Arabic-only shared controls in the tested shell areas.

- [ ] **Step 1: Add a focused Help integration test for the English shell labels**

```tsx
expect(screen.getByText("Help center")).toBeInTheDocument();
expect(screen.getByText("Search, open a page, or run a command...")).toBeInTheDocument();
```

- [ ] **Step 2: Run the Help test and verify it fails before the component changes**

Run: `pnpm test -- app/help/page.test.tsx`

- [ ] **Step 3: Run focused tests, full Next.js tests, typecheck, build, and Playwright CLI language-switch validation**

Run: `pnpm test && pnpm typecheck && pnpm build`

- [ ] **Step 4: Commit the localized shared shell**

```bash
git add archive-next/lib/i18n archive-next/components archive-next/app/help
git commit -m "feat(i18n): localize shared workspace shell"
```
