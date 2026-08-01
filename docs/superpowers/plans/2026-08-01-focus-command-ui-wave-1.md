# Focus Command UI Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the shared Arabic RTL, balanced-density Focus Command foundation across the Archive Suite app shell, command entry points, and mobile navigation.

**Architecture:** Retain the existing client-side shell components and layered CSS. Add semantic Focus Command tokens in the existing stylesheets, then consume them in `AppHeader`, `WorkspaceCommandBar`, and `MobilePrimaryNav`; no route, API, authorization, session, or data-layer behavior changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS layers, Vitest, React Testing Library, Playwright.

## Global Constraints

- All visible copy is clear Modern Standard Arabic and all layouts remain RTL.
- Preserve `archive-next` public API bindings, Laravel authorization, session flow, route inventory, and existing theme presets.
- Use the existing CSS layers under `archive-next/app/styles/`; do not introduce a styling dependency.
- Every interactive mobile target is at least 44px × 44px.
- Support mouse, touch, keyboard, visible focus, `prefers-reduced-motion`, and assistive technologies.
- Keep density balanced: no unreadable Arabic type, one-character status labels, or permanent high-density tables in this wave.

---

## Manager UI/UX Review Before Implementation

**Decision:** Approve the Focus Command direction with balanced density.

**Strengths to preserve:** the existing Arabic-first font setup, command palette integration, route announcer, focus mode, density preference, and mobile primary navigation.

**Must fix in Wave 1:** visual hierarchy currently competes between the top bar and command bar; command entry is duplicated without one clear primary treatment; the mobile navigation exposes more routes but not the fastest command action; shared surface, border, focus, and spacing values are not explicitly expressed as one Focus Command token set.

**Defer deliberately:** page-specific dashboards, media timelines, upload workflows, reporting charts, and settings tables. They require route-level visual baselines after the shell foundation is stable.

## Task 1: Establish shared Focus Command tokens and balanced-density rules

**Files:**
- Modify: `archive-next/app/styles/08-foundation.css`
- Modify: `archive-next/app/styles/03-components.css`
- Modify: `archive-next/app/styles/04-tables.css`
- Test: `archive-next/app/styles/focus-command-wave-1.test.ts`

**Interfaces:**
- Consumes: the existing dark and light theme variables.
- Produces: semantic CSS custom properties `--focus-canvas`, `--focus-surface`, `--focus-surface-raised`, `--focus-border`, `--focus-accent`, `--focus-ring`, and `--focus-row-min-height`.

- [ ] **Step 1: Write the failing token contract test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(resolve(process.cwd(), "app/styles/08-foundation.css"), "utf8");

describe("Focus Command token contract", () => {
  it("defines semantic canvas, surface, border, accent, focus and balanced-density tokens", () => {
    for (const token of [
      "--focus-canvas", "--focus-surface", "--focus-surface-raised",
      "--focus-border", "--focus-accent", "--focus-ring", "--focus-row-min-height"
    ]) expect(foundation).toContain(token);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --dir archive-next test -- focus-command-wave-1.test.ts`

Expected: FAIL because the tokens are not yet declared.

- [ ] **Step 3: Add semantic tokens and consume them in shared surfaces**

```css
:root {
  --focus-canvas: #0b0f17;
  --focus-surface: #131b2e;
  --focus-surface-raised: #1e293b;
  --focus-border: rgb(255 255 255 / 8%);
  --focus-accent: #3b82f6;
  --focus-ring: #10b981;
  --focus-row-min-height: 2.5rem;
}
```

Use these tokens for the shell surface, elevated command surface, table headers, visible focus rings, and table row minimum height. Retain existing light-preset overrides.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `pnpm --dir archive-next test -- focus-command-wave-1.test.ts; pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the token slice**

```bash
git add archive-next/app/styles/08-foundation.css archive-next/app/styles/03-components.css archive-next/app/styles/04-tables.css archive-next/app/styles/focus-command-wave-1.test.ts
git commit -m "feat: add focus command design tokens"
```

## Task 2: Make the command entry point the clear desktop workspace action

**Files:**
- Modify: `archive-next/components/WorkspaceCommandBar.tsx`
- Modify: `archive-next/components/WorkspaceCommandBar.test.tsx`
- Modify: `archive-next/app/styles/03-components.css`

**Interfaces:**
- Consumes: `openCommandPalette`, `getShortcut`, and the Focus Command tokens from Task 1.
- Produces: one accessible primary command-search control with keyboard hint and contextual quick actions.

- [ ] **Step 1: Write the failing component test**

```tsx
it("exposes the workspace command entry as the primary search action", () => {
  render(<WorkspaceCommandBar />);
  expect(screen.getByRole("button", { name: "بحث، فتح صفحة، أو تنفيذ أمر" })).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
  expect(screen.getByText(/Ctrl|Cmd/)).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --dir archive-next test -- WorkspaceCommandBar.test.tsx`

Expected: FAIL until the control has the normalized accessible name.

- [ ] **Step 3: Normalize the command entry and its hierarchy**

Keep the existing action handler. Give the search button an explicit Arabic accessible name, retain the shortcut hint, move decorative context below the search in CSS at narrow desktop widths, and style the search control as the only raised primary surface in the command bar.

- [ ] **Step 4: Verify behavior and keyboard contract**

Run: `pnpm --dir archive-next test -- WorkspaceCommandBar.test.tsx; pnpm typecheck`

Expected: PASS, with no route or auth behavior changes.

- [ ] **Step 5: Commit the command-bar slice**

```bash
git add archive-next/components/WorkspaceCommandBar.tsx archive-next/components/WorkspaceCommandBar.test.tsx archive-next/app/styles/03-components.css
git commit -m "feat: emphasize workspace command entry"
```

## Task 3: Align desktop navigation with the Focus Command hierarchy

**Files:**
- Modify: `archive-next/components/AppHeader.tsx`
- Modify: `archive-next/components/AppHeader.test.tsx`
- Modify: `archive-next/app/styles/02-layout.css`
- Modify: `archive-next/app/styles/03-components.css`

**Interfaces:**
- Consumes: `primaryNav`, `navSectionLabels`, `openCommandPalette`, and existing focus-restoration behavior.
- Produces: a right-side grouped navigation with consistent selected, hover, disabled-scroll-control, and keyboard-focus states.

- [ ] **Step 1: Write failing regression tests for command and navigation labels**

```tsx
it("keeps command palette and navigation controls discoverable", () => {
  render(<AppHeader subtitle="مساحة العمل" />);
  expect(screen.getByRole("button", { name: "فتح لوحة الأوامر" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "المسارات الرئيسية" })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test to verify the baseline**

Run: `pnpm --dir archive-next test -- AppHeader.test.tsx`

Expected: PASS before CSS changes; use this as a regression guard.

- [ ] **Step 3: Add Focus Command navigation styling without changing behavior**

Apply token-backed active-route indicator on the right edge, a restrained elevated background for the active route, matching focus rings, a clear compact shortcut treatment where supported, and consistent disabled styling for sidebar scroll controls. Preserve group expansion, scroll controls, and focus restoration exactly as implemented.

- [ ] **Step 4: Verify component behavior and the route inventory**

Run: `pnpm --dir archive-next test -- AppHeader.test.tsx; pnpm typecheck`

Expected: PASS, including current expand/collapse and Escape behavior.

- [ ] **Step 5: Commit the navigation slice**

```bash
git add archive-next/components/AppHeader.tsx archive-next/components/AppHeader.test.tsx archive-next/app/styles/02-layout.css archive-next/app/styles/03-components.css
git commit -m "feat: refine focus command navigation"
```

## Task 4: Add a mobile command entry while retaining daily navigation

**Files:**
- Modify: `archive-next/components/MobilePrimaryNav.tsx`
- Modify: `archive-next/components/MobilePrimaryNav.test.tsx`
- Modify: `archive-next/app/styles/02-layout.css`
- Test: `archive-next/e2e/keyboard-navigation.spec.ts`

**Interfaces:**
- Consumes: `openCommandPalette` and existing daily navigation data.
- Produces: an explicit Arabic “الأوامر” mobile button that opens the same palette, alongside the existing “المزيد” drawer button.

- [ ] **Step 1: Write the failing mobile command test**

```tsx
it("opens the global command palette from the mobile navigation", async () => {
  const user = userEvent.setup();
  render(<MobilePrimaryNav />);
  await user.click(screen.getByRole("button", { name: "فتح الأوامر" }));
  expect(openCommandPalette).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --dir archive-next test -- MobilePrimaryNav.test.tsx`

Expected: FAIL because the dedicated command control does not exist.

- [ ] **Step 3: Implement the command entry and 44px sizing**

Add an icon-and-label `button` before “المزيد” that invokes `openCommandPalette`, carries `aria-label="فتح الأوامر"`, and is styled with a 44px minimum target. Keep “المزيد” and its current event unchanged.

- [ ] **Step 4: Verify mobile keyboard and accessibility behavior**

Run: `pnpm --dir archive-next test -- MobilePrimaryNav.test.tsx; pnpm --dir archive-next exec playwright test e2e/keyboard-navigation.spec.ts`

Expected: PASS; opening or closing the command palette must preserve usable focus.

- [ ] **Step 5: Commit the mobile slice**

```bash
git add archive-next/components/MobilePrimaryNav.tsx archive-next/components/MobilePrimaryNav.test.tsx archive-next/app/styles/02-layout.css archive-next/e2e/keyboard-navigation.spec.ts
git commit -m "feat: add mobile command entry"
```

## Task 5: Verify the wave visually and preserve the baseline

**Files:**
- Modify: `archive-next/e2e/visual-regression.spec.ts`
- Modify: `archive-next/e2e/accessibility.spec.ts`
- Evidence: `archive-next/visual-evidence/focus-command-wave-1/`

**Interfaces:**
- Consumes: the shell and navigation contracts from Tasks 1–4.
- Produces: desktop, tablet, and mobile evidence for the global shell and an accessibility regression gate.

- [ ] **Step 1: Add desktop, tablet, and mobile shell coverage**

Add route assertions for the command entry, right-side navigation at 1280px, and mobile command entry at 375px. Reuse existing authentication fixtures and route inventory helpers; do not create alternate test setup.

- [ ] **Step 2: Run visual and accessibility tests before final styling adjustment**

Run: `pnpm --dir archive-next exec playwright test e2e/visual-regression.spec.ts e2e/accessibility.spec.ts`

Expected: The visual baseline changes only for the intended shell controls; no serious axe violations.

- [ ] **Step 3: Correct any contrast, overflow, focus, or target-size failure in its owning component**

Do not add global exception rules. Fix the responsible component or style rule and re-run the failed focused test.

- [ ] **Step 4: Run final Wave 1 verification**

Run: `pnpm typecheck; pnpm --dir archive-next test; pnpm build:next`

Expected: PASS.

- [ ] **Step 5: Commit verification updates**

```bash
git add archive-next/e2e/visual-regression.spec.ts archive-next/e2e/accessibility.spec.ts archive-next/visual-evidence/focus-command-wave-1
git commit -m "test: cover focus command shell"
```
