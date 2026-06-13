# v4 "Glass + Green" Theme Identity — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ LANGUAGE / ENCODING NOTE — READ FIRST.** This plan is written in English on purpose: the executing agent does not render Arabic reliably. The app's UI strings are Arabic. **Treat every Arabic string in this plan as opaque bytes: copy it verbatim into the code, never translate it, never retype it by hand, never "fix" it.** Each Arabic literal is followed by an English gloss in an HTML/JS comment so you know what it means without needing to read the Arabic. If a code block contains Arabic, copy the whole block exactly.

**Goal:** Add a new switchable theme identity `v4` ("Glass + Green") to the existing multi-version theme system, applied app-wide via CSS, opt-in through the existing theme-version picker, with a hard color-contrast gate.

**Architecture:** The app already has three theme identities — `v1` (classic), `v2` (modern), `v3` (operations command-center, default) — selected via the `data-theme-version` attribute on `<html>`. Each identity is one CSS file that defines `--va-N-*` tokens (dark + light) and maps them onto a shared abstraction layer (`--va-action`, `--va-ink-*`, `--va-text-*`, `--va-line*`, radius tokens) that all `.va-*` component classes consume. **This plan adds `v4` the same way.** Because every page already uses `.va-*` classes, a new identity restyles the whole app at once, and switching back to `v3` is instant — so the existing theme-version mechanism *is* the feature flag the spec requires (opt-in, one-click rollback, zero regression for v1/v2/v3 users since all v4 rules are scoped under `html[data-theme-version="v4"]`).

**Tech Stack:** Vite 8, React 19 (via `react/jsx-runtime` `jsx`/`jsxs` — this codebase authors JSX as function calls, not `<>` syntax), Tailwind 4, Framer Motion, Lucide React. Tests: `npm run verify` (Node `assert/strict` on pure view-model functions in `scripts/verify-modules.mjs`) and `npm run test:a11y` (Playwright + axe-core matrix in `tests/a11y.spec.ts`). There is **no** vitest/jest; do not introduce one.

**Spec:** `docs/superpowers/specs/2026-06-02-ux-ui-redesign-design.md` (v4).

**Scope of THIS plan:** Spec sections 0, 1, 2 (sidebar visual only), 2.5 (glass policy), 2.6 (bidi), 3 (design system), and the motion/contrast gates. It produces a working, switchable, contrast-passing `v4` identity applied across all existing pages. Page-level redesigns (archive cards, detail/add, 7-tab settings, onboarding, ListPage, special pages) are **follow-up plans** listed at the end — each is its own shippable slice.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/theme/themeVersionStorage.js` | Valid versions + persistence | Modify: add `"v4"` |
| `src/styles/v4-identity.css` | All v4 tokens (dark+light) + `.va-*` restyles scoped to v4 | Create |
| `src/main.js` | CSS import order + boot | Modify: import v4 css |
| `src/features/settings/ThemeVersionPicker.jsx` | Theme-version chooser UI | Modify: add v4 option |
| `src/stores/settingsDefaults.js` | Comment listing valid versions | Modify: doc only |
| `src/theme/motion.js` | Motion tokens + `staggerFor` cap | Create |
| `scripts/verify-modules.mjs` | Node-assert unit tests | Modify: add tests |
| `tests/a11y.v4-contrast.spec.ts` | v4 color-contrast gate | Create |

> **Why a new motion file:** the spec mandates a capped stagger (`staggerFor`, first 12 items only) and a single ease curve. These are pure functions → unit-testable with Node assert. JSX components and CSS are not unit-tested here; they are gated by build success (`npm run check`) + the a11y matrix + visual verification.

---

## Task 1: Register the `v4` theme version

**Files:**
- Modify: `src/theme/themeVersionStorage.js:9`
- Test: `scripts/verify-modules.mjs` (append a new assertion block)

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-modules.mjs` (near the other imports at top, add the import; place the assertions after the existing blocks). Add this import line with the other `../src` imports:

```js
import {
  normalizeThemeVersion,
  DEFAULT_THEME_VERSION
} from "../src/theme/themeVersionStorage.js";
```

Then append this assertion block at the end of the file:

```js
// --- v4 theme version registration ---
assert.equal(normalizeThemeVersion("v4"), "v4", "v4 must be a valid theme version");
assert.equal(normalizeThemeVersion("v3"), "v3", "v3 still valid");
assert.equal(normalizeThemeVersion("nope"), DEFAULT_THEME_VERSION, "unknown falls back to default");
console.log("ok: theme version v4 registered");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run verify`
Expected: FAIL — assertion error "v4 must be a valid theme version" (current `VALID_VERSIONS` has only v1/v2/v3).

- [ ] **Step 3: Make the change**

In `src/theme/themeVersionStorage.js`, change line 9 from:

```js
const VALID_VERSIONS = new Set(["v1", "v2", "v3"]);
```

to:

```js
const VALID_VERSIONS = new Set(["v1", "v2", "v3", "v4"]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run verify`
Expected: PASS — prints `ok: theme version v4 registered`.

- [ ] **Step 5: Commit**

```bash
git add "src/theme/themeVersionStorage.js" scripts/verify-modules.mjs
git commit -m "feat(theme): register v4 theme version"
```

---

## Task 2: Create the `v4-identity.css` token layer (dark + light)

**Files:**
- Create: `src/styles/v4-identity.css`
- Modify: `src/main.js:5` (add import after v3)

This file mirrors the structure of `src/styles/v3-identity.css`: define `--va-4-*` raw tokens under `:root`, then map them onto the shared `--va-*` abstraction layer inside `html[data-theme-version="v4"]`, then a `html.light[data-theme-version="v4"]` block that overrides only the raw tokens for light mode.

> Per spec §2.5, content surfaces are SOLID (`--va-4-surface*`); glass (`backdrop-filter`) is reserved for chrome and added in Task 4. Per spec §3, contrast tokens are chosen to pass WCAG AA (gated in Task 8).

- [ ] **Step 1: Create the file**

Create `src/styles/v4-identity.css` with exactly this content:

```css
/*
 * Theme v4 — "Glass + Green".
 * Solid surfaces for dense content (cards, tables); glass reserved for
 * chrome (sidebar, topbar, modals) — see Task 4. Dark + light, mapped
 * onto the shared --va-* abstraction layer like v1/v2/v3. Activates only
 * under <html data-theme-version="v4">.
 */

:root {
  /* canvases + solid surfaces (content uses these — NO blur) */
  --va-4-canvas:    #060b12;
  --va-4-canvas-2:  #080f1a;
  --va-4-rail:      #04070e;
  --va-4-surface:   #0d1626;  /* card/table solid surface */
  --va-4-surface-2: #131e33;  /* hover / elevated */
  --va-4-surface-3: #1a2740;
  --va-4-surface-hot: #0f2a24;

  /* glass tint (chrome only — paired with backdrop-filter in Task 4) */
  --va-4-glass:      rgba(255, 255, 255, 0.03);
  --va-4-glass-2:    rgba(255, 255, 255, 0.06);

  --va-4-line-soft:   rgba(148, 163, 184, 0.08);
  --va-4-line:        rgba(148, 163, 184, 0.14);
  --va-4-line-strong: rgba(148, 163, 184, 0.24);

  /* text — contrast verified vs --va-4-surface in Task 8 */
  --va-4-text-strong: #f1f5f9;
  --va-4-text:        #cbd5e1;
  --va-4-text-soft:   #94a3b8;
  --va-4-text-faint:  #64748b;  /* AA on solid surface; never used < 12px */

  --va-4-accent:        #10b981;
  --va-4-accent-strong: #059669;
  --va-4-success: #10b981;
  --va-4-amber:   #fbbf24;
  --va-4-danger:  #f87171;

  --va-4-radius-sm: 0.5rem;
  --va-4-radius-md: 0.75rem;
  --va-4-radius-lg: 1rem;
  --va-4-radius-xl: 1.25rem;

  --va-4-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --va-4-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
}

html[data-theme-version="v4"] {
  --va-action:        var(--va-4-accent);
  --va-action-strong: var(--va-4-accent-strong);

  --va-ink-950: var(--va-4-canvas);
  --va-ink-925: var(--va-4-rail);
  --va-ink-900: var(--va-4-surface);
  --va-ink-850: var(--va-4-surface-2);
  --va-ink-800: var(--va-4-surface-3);
  --va-ink-700: var(--va-4-line-strong);
  --va-ink-600: var(--va-4-text-faint);
  --va-ink-500: var(--va-4-text-soft);

  --va-line-soft:   var(--va-4-line-soft);
  --va-line:        var(--va-4-line);
  --va-line-strong: var(--va-4-line-strong);

  --va-text-strong: var(--va-4-text-strong);
  --va-text:        var(--va-4-text);
  --va-text-soft:   var(--va-4-text-soft);
  --va-text-faint:  var(--va-4-text-faint);

  --va-panel-radius:   var(--va-4-radius-xl);
  --va-card-radius:    var(--va-4-radius-lg);
  --va-control-radius: var(--va-4-radius-md);

  color-scheme: dark;
}

html.light[data-theme-version="v4"] {
  /* Light is a first-class theme: identity carried by shadows + solid
     borders, NOT glow (glow collapses on light bg — spec §3). */
  --va-4-canvas:    #eef2f7;
  --va-4-canvas-2:  #e8eef4;
  --va-4-rail:      #ffffff;
  --va-4-surface:   #ffffff;
  --va-4-surface-2: #f8fafc;
  --va-4-surface-3: #eef3f8;
  --va-4-surface-hot: #ecfdf5;

  --va-4-glass:   rgba(255, 255, 255, 0.80);
  --va-4-glass-2: #ffffff;

  --va-4-line-soft:   rgba(15, 23, 42, 0.08);
  --va-4-line:        #dde3eb;
  --va-4-line-strong: #cbd5e1;

  --va-4-text-strong: #0f172a;
  --va-4-text:        #1e293b;
  --va-4-text-soft:   #475569;
  --va-4-text-faint:  #64748b;

  --va-4-accent:        #059669;
  --va-4-accent-strong: #047857;

  color-scheme: light;
}

html[data-theme-version="v4"] body {
  background: var(--va-4-canvas);
  color: var(--va-4-text);
}
```

- [ ] **Step 2: Import the file**

In `src/main.js`, after line 5 (`import "./styles/v3-identity.css";`) add:

```js
import "./styles/v4-identity.css";
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run check`
Expected: `npm run verify` passes, then `vite build --mode spa` completes without CSS errors. (The CSS is valid but not yet visually applied to components — that is Tasks 4–5.)

- [ ] **Step 4: Commit**

```bash
git add "src/styles/v4-identity.css" src/main.js
git commit -m "feat(theme): add v4 identity token layer (dark + light)"
```

---

## Task 3: Add `v4` to the theme-version picker

**Files:**
- Modify: `src/features/settings/ThemeVersionPicker.jsx:15-32` (the `OPTIONS` array)
- Modify: `src/stores/settingsDefaults.js:32-39` (comment only)

- [ ] **Step 1: Add the option**

In `src/features/settings/ThemeVersionPicker.jsx`, the `OPTIONS` array starts at line 15. Add this object as the FIRST element of the array (so it appears first), keeping the existing v3/v1/v2 entries after it. Copy the Arabic strings verbatim:

```js
  {
    id: "v4",
    title: "زجاجي أخضر",          /* gloss: "Glass Green" */
    detail: "هوية حديثة — أسطح زجاجية للحواف، أخضر زمردي، وتباين عالٍ.", /* gloss: "Modern identity — glass chrome, emerald green, high contrast." */
    badge: "جديد"                 /* gloss: "New" */
  },
```

> Note: the existing v3 entry has `badge: "افتراضي"` (gloss: "Default"). Leave it — v3 stays the default until a later rollout decision. v4 is opt-in.

- [ ] **Step 2: Update the defaults comment (documentation only)**

In `src/stores/settingsDefaults.js`, the comment around lines 32–39 lists the valid theme versions. Update the prose so it reads `"v1" ... "v2" ... "v3" ... or "v4" (glass-green identity)`. Do **not** change the default value (`themeVersion: "v3"` stays).

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Visual verification**

Run the dev server: `npm run dev` (serves at `http://127.0.0.1:5173`). Open the app, go to Settings → المظهر (Appearance) → إصدار الواجهة (Interface version). Confirm a new card "زجاجي أخضر" appears and clicking it switches `<html data-theme-version="v4">` (check via DevTools elements panel). The page should adopt the v4 canvas background. Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add "src/features/settings/ThemeVersionPicker.jsx" src/stores/settingsDefaults.js
git commit -m "feat(settings): offer v4 in theme-version picker"
```

---

## Task 4: v4 chrome restyle (sidebar, topbar, modals = glass)

**Files:**
- Modify: `src/styles/v4-identity.css` (append component rules)

Per spec §2.5, glass (`backdrop-filter`) is allowed ONLY on chrome. The components already carry `.va-*` classes (e.g. `.va-sidebar`, `.va-app-shell`); we restyle them via CSS scoped to v4 — no JSX changes, so v1/v2/v3 are untouched.

- [ ] **Step 1: Append chrome rules**

Append to `src/styles/v4-identity.css`:

```css
/* ---- v4 chrome (glass allowed here only) ---- */

html[data-theme-version="v4"] .va-app-shell {
  background:
    radial-gradient(60rem 40rem at 30% -10rem,
      color-mix(in srgb, var(--va-4-accent) 12%, transparent), transparent 60%),
    var(--va-4-canvas);
  color: var(--va-4-text);
}
/* light mode: drop the glow, lean on the flat canvas (spec §3) */
html.light[data-theme-version="v4"] .va-app-shell {
  background: var(--va-4-canvas);
}

html[data-theme-version="v4"] .va-sidebar {
  background: color-mix(in srgb, var(--va-4-rail) 92%, transparent);
  backdrop-filter: blur(20px);
  border-color: var(--va-4-line);
}

html[data-theme-version="v4"] .va-sidebar-item-active {
  background: color-mix(in srgb, var(--va-4-accent) 12%, transparent);
  color: var(--va-4-text-strong);
}

/* topbar / page context bar — chrome */
html[data-theme-version="v4"] .va-topbar,
html[data-theme-version="v4"] .va-context-bar {
  background: color-mix(in srgb, var(--va-4-canvas) 70%, transparent);
  backdrop-filter: blur(16px);
  border-color: var(--va-4-line);
}

/* modals / command palette / toast — chrome */
html[data-theme-version="v4"] .va-modal,
html[data-theme-version="v4"] .va-command-palette,
html[data-theme-version="v4"] .va-toast {
  background: color-mix(in srgb, var(--va-4-surface) 85%, transparent);
  backdrop-filter: blur(24px);
  border-color: var(--va-4-line-strong);
}

/* perf + a11y: kill glow + blur when motion reduced or glass disabled */
html[data-theme-version="v4"][data-motion="reduced"] .va-app-shell,
html[data-theme-version="v4"][data-glass="off"] .va-sidebar,
html[data-theme-version="v4"][data-glass="off"] .va-topbar,
html[data-theme-version="v4"][data-glass="off"] .va-modal {
  backdrop-filter: none;
  background: var(--va-4-surface);
}
```

> **Before relying on a class name, confirm it exists.** Grep the codebase for each selector (`va-sidebar`, `va-app-shell`, `va-sidebar-item-active`, `va-topbar`, `va-context-bar`, `va-modal`, `va-command-palette`, `va-toast`). `va-sidebar` and `va-app-shell` and `va-sidebar-item-active` are confirmed present (see `src/components/navigation/Sidebar.jsx`). For any selector your grep does NOT find, leave the rule in (harmless — it just won't match yet) and note it in the commit body so the matching component task wires the class later.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Visual verification**

`npm run dev`, switch to v4, confirm the sidebar shows a translucent blurred panel and the active nav item has an emerald tint. Toggle dark/light (Settings → المظهر) and confirm the sidebar stays legible in both. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "src/styles/v4-identity.css"
git commit -m "feat(theme): v4 glass chrome (sidebar/topbar/modals)"
```

---

## Task 5: v4 content surfaces (cards/tables = SOLID, no blur)

**Files:**
- Modify: `src/styles/v4-identity.css` (append)

- [ ] **Step 1: Append content rules**

Append to `src/styles/v4-identity.css`:

```css
/* ---- v4 content surfaces (SOLID — no backdrop-filter, spec §2.5) ---- */

html[data-theme-version="v4"] .va-card,
html[data-theme-version="v4"] .va-surface,
html[data-theme-version="v4"] .va-table {
  background: var(--va-4-surface);   /* solid */
  border: 1px solid var(--va-4-line);
  border-radius: var(--va-card-radius);
  box-shadow: var(--va-4-shadow-sm);
}

html[data-theme-version="v4"] .va-card:hover {
  background: var(--va-4-surface-2);
  border-color: color-mix(in srgb, var(--va-4-accent) 22%, transparent);
  box-shadow: var(--va-4-shadow-md);
}

/* primary button + accent glow (single element — cheap) */
html[data-theme-version="v4"] .va-primary-button {
  background: var(--va-4-accent);
  color: #fff;
  box-shadow: 0 0 16px color-mix(in srgb, var(--va-4-accent) 30%, transparent);
}
html[data-theme-version="v4"] .va-primary-button:hover {
  background: var(--va-4-accent-strong);
}

/* tabular numerals for metadata/durations (spec §2.6 bidi) */
html[data-theme-version="v4"] .va-num,
html[data-theme-version="v4"] .va-number-badge {
  font-variant-numeric: tabular-nums;
}
```

> Grep to confirm `va-card`, `va-surface`, `va-primary-button`, `va-number-badge` exist (the last two are confirmed in `ArchivePageHero.jsx` / `Sidebar.jsx`). Same rule as Task 4: keep unmatched selectors, note them in the commit.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Visual verification**

`npm run dev`, switch to v4, open the Archive page. Confirm cards are solid (no see-through blur), hover lifts with an emerald border, and the primary "add" button is emerald with a soft glow. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "src/styles/v4-identity.css"
git commit -m "feat(theme): v4 solid content surfaces + primary button"
```

---

## Task 6: Motion tokens with capped stagger

**Files:**
- Create: `src/theme/motion.js`
- Test: `scripts/verify-modules.mjs` (append)

- [ ] **Step 1: Write the failing test**

Add this import with the other `../src` imports in `scripts/verify-modules.mjs`:

```js
import { staggerFor, transitions } from "../src/theme/motion.js";
```

Append this assertion block:

```js
// --- motion: stagger is capped at 12 items (spec §3) ---
assert.equal(staggerFor(0), 0, "first item no delay");
assert.equal(staggerFor(5), 5 * transitions.stagger, "within cap scales linearly");
assert.equal(staggerFor(11), 11 * transitions.stagger, "last capped item");
assert.equal(staggerFor(50), 12 * transitions.stagger, "beyond cap clamps to 12");
assert.ok(12 * transitions.stagger <= 0.5, "total stagger stays <= 500ms");
console.log("ok: motion stagger capped");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run verify`
Expected: FAIL — cannot find module `../src/theme/motion.js`.

- [ ] **Step 3: Create the module**

Create `src/theme/motion.js`:

```js
// Shared motion tokens for the v4 identity. One ease curve; capped stagger
// so a 100-card grid does not produce seconds of animation (spec §3).
export const transitions = {
  micro:    { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  standard: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  page:     { duration: 0.40, ease: [0.4, 0, 0.2, 1] },
  stagger:  0.04,
  springCard: { type: "spring", stiffness: 400, damping: 30 }
};

const STAGGER_CAP = 12;

// Delay (seconds) for the index-th item; clamps past STAGGER_CAP so the
// total never exceeds STAGGER_CAP * stagger (~480ms).
export function staggerFor(index) {
  const i = index < STAGGER_CAP ? index : STAGGER_CAP;
  return i * transitions.stagger;
}

export const cardVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.standard },
  hover:   { y: -2, transition: transitions.springCard }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run verify`
Expected: PASS — prints `ok: motion stagger capped`.

- [ ] **Step 5: Commit**

```bash
git add src/theme/motion.js scripts/verify-modules.mjs
git commit -m "feat(theme): capped motion tokens for v4"
```

---

## Task 7: Bidi safety for user-data fields (archive card title + path)

**Files:**
- Modify: `src/features/archive/ArchivePageHero.jsx` (the quick-result title, ~line 358)

Per spec §2.6, any field showing user data (titles, paths, URLs, filenames) must use `dir="auto"` so mixed Arabic/Latin content renders correctly. This task fixes the highest-traffic instance and establishes the pattern; later page plans apply it to detail/add/list pages.

- [ ] **Step 1: Locate the title element**

In `src/features/archive/ArchivePageHero.jsx`, find the quick-search match title (around line 358):

```js
jsx("span", { className: "block truncate text-xs font-semibold text-white", children: item.title || "بدون عنوان" }),
```

(`"بدون عنوان"` gloss: "No title".)

- [ ] **Step 2: Add `dir="auto"`**

Change it to (copy the Arabic literal verbatim):

```js
jsx("span", { dir: "auto", className: "block truncate text-xs font-semibold text-white", children: item.title || "بدون عنوان" }),
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Visual verification (the acceptance case from spec §2.6)**

`npm run dev`, open Archive, type in the search box to trigger quick results. If you have an item titled with a Latin filename (e.g. `Q4_report_FINAL_v2.mp4`), confirm it renders left-to-right and is not visually broken inside the RTL card. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add "src/features/archive/ArchivePageHero.jsx"
git commit -m "fix(a11y): dir=auto on archive quick-result titles (bidi)"
```

---

## Task 8: Color-contrast gate for v4

**Files:**
- Create: `tests/a11y.v4-contrast.spec.ts`

The existing `tests/a11y.spec.ts` disables `color-contrast` (it gates structure for v1/v2/v3, which carry known contrast debt). v4 must NOT inherit that debt: this new spec seeds the app, forces `data-theme-version="v4"`, and runs axe WITH `color-contrast` ENABLED on the core pages.

- [ ] **Step 1: Create the test**

Create `tests/a11y.v4-contrast.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Reuse the seeding approach from a11y.spec.ts but force v4 + run the
// color-contrast rule that the legacy matrix intentionally skips.
const ROUTES = [
  { route: '#/dashboard', heading: 'مركز التحكم' }, // gloss: Control Center
  { route: '#/archive',   heading: 'الأرشيف' },     // gloss: Archive
  { route: '#/settings',  heading: 'الإعدادات' }    // gloss: Settings
];

async function forceV4(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('videoArchive:themeVersion', 'v4');
    localStorage.setItem('videoArchive:theme', 'dark');
  });
}

for (const target of ROUTES) {
  test(`v4 contrast: ${target.route}`, async ({ page }) => {
    await forceV4(page);
    await page.goto(`/${target.route}`, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .options({ runOnly: ['color-contrast'] })
      .analyze();
    const violations = results.violations.filter(v => v.id === 'color-contrast');
    expect(violations, JSON.stringify(violations.map(v => ({
      nodes: v.nodes.map(n => ({ target: n.target, html: n.html }))
    })), null, 2)).toEqual([]);
  });
}
```

> If the seeded routes require auth/data to render (the legacy spec seeds IndexedDB heavily), and these pages render empty without it, copy the `seedLocalArchive` helper from `tests/a11y.spec.ts` and call it before `forceV4`. Start minimal; add seeding only if the page heading never appears.

- [ ] **Step 2: Run the test**

Run: `npm run test:a11y -- a11y.v4-contrast`
Expected: Initially this may FAIL and report exact elements/colors below 4.5:1. That report is the worklist.

- [ ] **Step 3: Fix any contrast failures in `v4-identity.css`**

For each reported element, adjust the relevant `--va-4-text-*` token (or the surface it sits on) in `src/styles/v4-identity.css` until it passes. Do NOT lower the threshold or re-disable the rule. Re-run Step 2 until green. (If zero violations on first run, note that and proceed.)

- [ ] **Step 4: Commit**

```bash
git add tests/a11y.v4-contrast.spec.ts "src/styles/v4-identity.css"
git commit -m "test(a11y): contrast gate for v4 + token fixes"
```

---

## Task 9: Foundation acceptance + final verification

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: `verify` passes (all assert blocks incl. v4 + motion) and the SPA build completes.

- [ ] **Step 2: Full a11y matrix**

Run: `npm run test:a11y`
Expected: legacy matrix green AND the new v4 contrast spec green.

- [ ] **Step 3: Manual cross-theme smoke**

`npm run dev`. For v4 in BOTH dark and light: open Dashboard, Archive, Settings. Confirm: legible text, solid cards, glass sidebar/topbar, emerald primary buttons, and that switching back to v3 (Settings → المظهر → إصدار الواجهة → مركز التحكم) instantly restores the old look (rollback works). Stop the server.

- [ ] **Step 4: Final commit (if any tweaks)**

```bash
git add -A
git commit -m "chore(theme): v4 foundation acceptance pass"
```

---

## Self-Review (completed by plan author)

- **Spec coverage (this slice):** §0 success metrics → measured outside code (note below); §1 decisions → v4 identity, single accent default, light first-class; §2 sidebar visual → Task 4; §2.5 glass policy → Tasks 4/5 (chrome glass, solid content) + reduced-motion/glass-off kill switch; §2.6 bidi → Tasks 5 (tabular-nums) + 7 (dir=auto) + the v4 acceptance case; §3 tokens/motion/contrast → Tasks 2/6/8. Page-level sections (4 archive grid, 5 detail/add, 6 onboarding, 7 settings 7-tab, 9 ListPage) are explicitly OUT of this slice → follow-up plans below.
- **Placeholder scan:** none — every CSS/JS block is complete and copy-paste ready.
- **Type consistency:** `staggerFor`/`transitions`/`cardVariants` names match between `motion.js` and its test; `normalizeThemeVersion`/`DEFAULT_THEME_VERSION` match the existing module exports; token names `--va-4-*` and shared `--va-*` mappings consistent across Tasks 2/4/5/8.

---

## Follow-up plans (each its own shippable slice — write with writing-plans when ready)

1. **v4 Archive grid** — card markup for 16:9 thumb + duration/quality/favorite badges + always-visible `⋮` action (no hover-only), `focus-within` parity, thumbnail placeholder, virtualization (windowing >100), Empty/Skeleton/Error states, improved pagination. (Spec §4 + components.)
2. **v4 Video Detail + Add pages** — player + metadata + history tabs; add-form with `#` tag recall + `useFormSaveState`; `dir="auto"` on all data fields. (Spec §5.)
3. **v4 Settings (7 tabs)** — real tabs from `settingsTabs.js` with role badges, explicit-save bar (`useFormSaveState`/`draftState`), Maintenance double-confirm. (Spec §7.)
4. **v4 Onboarding (3 steps)** — welcome / first-video (advanced storage in accordion) / done. (Spec §6.)
5. **v4 ListPage pattern + Tier-A/B pages** — shared list scaffold then per-page editors. (Spec §9.)
6. **v4 special pages + final polish** — graph, projects timeline, help; ARIA live + focus-trap (`useFocusTrap.js`); reduced-motion sweep; success-metric re-measure vs baseline (spec §0) before flipping v4 to default.

> **Spec §0 metrics are not code** — they are measured before (baseline, on current v3) and after (on v4) by the team. Capture the baseline before starting Follow-up plan 1 so the §0 gate is meaningful.
