# Theme v2 — PR A (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v2 theme foundation — token definitions, settings field, and runtime wiring — with zero visible change for users (default stays `v1`). After this PR an engineer can toggle to v2 via `localStorage` and see the basic token effects, but no component yet opts into v2-only classes. Provides the substrate for PRs B–F.

**Architecture:** A new CSS file `src/styles/v2-identity.css` defines `--va-2-*` tokens. A new storage module `src/theme/themeVersionStorage.js` reads/writes the user preference. A new boot step `applyInitialThemeVersion()` sets `<html data-theme-version="v1|v2">` before React mounts. Settings defaults gain a `themeVersion` field. **Zero React component is modified in this PR** — the whole change is CSS + boot wiring + one settings field.

**Tech Stack:** Vite 7, React 19, Tailwind CSS, vite-plugin-singlefile, IndexedDB for settings persistence.

**Reference spec:** `docs/superpowers/specs/2026-05-28-theme-v2-design.md`

---

## File Structure

**Create (4 files):**
- `src/styles/v2-identity.css` — all v2 tokens; gradient surface classes; ~180 lines
- `src/theme/themeVersionStorage.js` — read/write `videoArchive:themeVersion` localStorage key
- `src/theme/applyInitialThemeVersion.js` — pre-React boot helper that sets `<html data-theme-version="…">`
- `scripts/verify-modules.theme-v2.mjs` — small test runner that exercises the storage helpers

**Modify (3 files):**
- `src/stores/settingsDefaults.js` — add `themeVersion: "v1"` to `ui` defaults + merge function carries it through
- `src/main.js` — import the new v2 CSS, call `applyInitialThemeVersion()`
- `scripts/verify-modules.mjs` — add a `run(...)` call that imports and runs the theme-v2 storage tests

**Untouched:** every other file. `v1-identity.css` is not modified. `src/components/*`, `src/pages/*`, and every slice stay byte-identical.

---

## Pre-flight check

- [ ] **Confirm clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` on branch `main`

- [ ] **Create the branch**

Run: `git checkout -b feat/theme-v2-pr-a-foundation`
Expected: `Switched to a new branch 'feat/theme-v2-pr-a-foundation'`

- [ ] **Baseline the build size**

Run: `npm run build 2>&1 | tail -3`
Expected: `dist/index.html  1,592.XX kB`
Note: record this number. Final build must not exceed it by more than ~2 KB.

---

## Task 1: Storage module + tests

**Files:**
- Create: `src/theme/themeVersionStorage.js`
- Create: `scripts/verify-modules.theme-v2.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-modules.theme-v2.mjs`:

```js
import assert from "node:assert/strict";
import {
  DEFAULT_THEME_VERSION,
  THEME_VERSION_STORAGE_KEY,
  getStoredThemeVersion,
  normalizeThemeVersion,
  storeThemeVersion
} from "../src/theme/themeVersionStorage.js";

// Polyfill localStorage on Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

function run(name, fn) {
  try { fn(); console.log("ok -", name); }
  catch (error) { console.error("FAIL -", name, "\n", error); process.exitCode = 1; }
}

run("default version is v1", () => {
  store.clear();
  assert.equal(DEFAULT_THEME_VERSION, "v1");
  assert.equal(getStoredThemeVersion(), "v1");
});

run("normalize accepts v1 and v2 only", () => {
  assert.equal(normalizeThemeVersion("v1"), "v1");
  assert.equal(normalizeThemeVersion("v2"), "v2");
  assert.equal(normalizeThemeVersion(null), "v1");
  assert.equal(normalizeThemeVersion("v3"), "v1");
  assert.equal(normalizeThemeVersion(undefined), "v1");
  assert.equal(normalizeThemeVersion(""), "v1");
});

run("storeThemeVersion writes to localStorage", () => {
  store.clear();
  storeThemeVersion("v2");
  assert.equal(store.get(THEME_VERSION_STORAGE_KEY), "v2");
  assert.equal(getStoredThemeVersion(), "v2");
});

run("storeThemeVersion ignores invalid values", () => {
  store.clear();
  storeThemeVersion("v1");
  storeThemeVersion("nonsense");
  // last write should have been a no-op
  assert.equal(store.get(THEME_VERSION_STORAGE_KEY), "v1");
});

run("storage key is namespaced", () => {
  assert.equal(THEME_VERSION_STORAGE_KEY, "videoArchive:themeVersion");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/verify-modules.theme-v2.mjs`
Expected: Crashes with `Cannot find module '../src/theme/themeVersionStorage.js'`

- [ ] **Step 3: Implement the storage module**

Create `src/theme/themeVersionStorage.js`:

```js
export const THEME_VERSION_STORAGE_KEY = "videoArchive:themeVersion";
export const DEFAULT_THEME_VERSION = "v1";

const VALID_VERSIONS = new Set(["v1", "v2"]);

export function normalizeThemeVersion(value) {
  if (typeof value !== "string") return DEFAULT_THEME_VERSION;
  return VALID_VERSIONS.has(value) ? value : DEFAULT_THEME_VERSION;
}

export function getStoredThemeVersion() {
  try {
    const raw = localStorage.getItem(THEME_VERSION_STORAGE_KEY);
    return normalizeThemeVersion(raw);
  } catch {
    return DEFAULT_THEME_VERSION;
  }
}

export function storeThemeVersion(value) {
  const normalized = normalizeThemeVersion(value);
  if (normalized !== value) return false;
  try {
    localStorage.setItem(THEME_VERSION_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/verify-modules.theme-v2.mjs`
Expected:
```
ok - default version is v1
ok - normalize accepts v1 and v2 only
ok - storeThemeVersion writes to localStorage
ok - storeThemeVersion ignores invalid values
ok - storage key is namespaced
```
Exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/theme/themeVersionStorage.js scripts/verify-modules.theme-v2.mjs
git commit -m "feat(theme-v2): storage module for themeVersion preference

Reads/writes videoArchive:themeVersion in localStorage. Normalizes
to v1 by default so users on the v1 build before this PR get no
behavior change.

5 verify-modules tests cover default, normalization,
write-then-read, invalid-value rejection, and storage key
namespacing."
```

---

## Task 2: Boot-time application

**Files:**
- Create: `src/theme/applyInitialThemeVersion.js`
- Modify: `src/main.js` (lines 1–10)

- [ ] **Step 1: Implement the boot helper**

Create `src/theme/applyInitialThemeVersion.js`:

```js
import { getStoredThemeVersion } from "./themeVersionStorage.js";

/**
 * Pre-React boot step that sets `<html data-theme-version="v1|v2">`
 * from localStorage. Mirrors applyInitialTheme.js — runs before
 * React mounts so v2 token cascade is in place on first paint.
 *
 * Returns the resolved version so callers can log it if needed.
 */
export function applyInitialThemeVersion() {
  const version = getStoredThemeVersion();
  document.documentElement.setAttribute("data-theme-version", version);
  return version;
}
```

- [ ] **Step 2: Modify main.js to import the new helper and call it**

Edit `src/main.js`:

Replace the entire file with:

```js
import "./styles/generated-tailwind.css";
import "./styles/app-overrides.css";
import "./styles/v1-identity.css";
import "./styles/v2-identity.css";

import { startVideoArchive } from "./app/startVideoArchive.js";
import { applyInitialTheme } from "./theme/applyInitialTheme.js";
import { applyInitialThemeVersion } from "./theme/applyInitialThemeVersion.js";

applyInitialThemeVersion();
applyInitialTheme();
startVideoArchive();
```

Note: `v2-identity.css` doesn't exist yet — we add it in Task 3. We import it now so the import statement lands in this commit; the build will error until Task 3 lands. That's fine because we commit per-task and Task 3 is the very next commit.

- [ ] **Step 3: Stage but don't commit yet**

Run: `git add src/main.js src/theme/applyInitialThemeVersion.js`

(Don't commit — Task 3 ships the CSS file the import needs.)

---

## Task 3: v2 CSS tokens

**Files:**
- Create: `src/styles/v2-identity.css`

- [ ] **Step 1: Write the CSS file**

Create `src/styles/v2-identity.css`:

```css
/*
 * Theme v2 — Linear/Vercel-inspired token layer.
 * Activated when <html data-theme-version="v2"> is set.
 * Default v1 cascade is preserved (no change for existing users).
 *
 * Naming: --va-2-* mirrors v1's --va-* so component code can stay
 * unchanged. Component-level v2-only classes (.va-2-card etc.)
 * land in PR B.
 */

:root {
  /* Dark mode (default) tokens for v2 — defined globally so v1
   * users still pay the cost of CSS variable definitions but
   * never read them. ~1KB of dead CSS that PR F will activate. */
  --va-2-canvas:        #0a0b0e;
  --va-2-surface:       #14161b;
  --va-2-surface-2:     #1a1d24;
  --va-2-surface-3:     #232830;

  --va-2-line:          rgba(255, 255, 255, 0.06);
  --va-2-line-strong:   rgba(255, 255, 255, 0.12);

  --va-2-text-strong:   #f8f9fb;
  --va-2-text:          #d4d6dc;
  --va-2-text-soft:     #a8acb8;
  --va-2-text-faint:    #6e727e;

  /* Accent presets — indigo default, re-tuned for v2's canvas. */
  --va-2-accent:        #6366f1;
  --va-2-accent-strong: #4f46e5;
  --va-2-accent-soft:   color-mix(in srgb, var(--va-2-accent) 12%, transparent);
  --va-2-accent-glow:   color-mix(in srgb, var(--va-2-accent) 25%, transparent);

  /* Semantic colors */
  --va-2-success:       #10b981;
  --va-2-danger:        #ef4444;
  --va-2-warning:       #f59e0b;
  --va-2-info:          #3b82f6;

  /* Radii — larger than v1 */
  --va-2-radius-sm:     0.5rem;
  --va-2-radius-md:     0.75rem;
  --va-2-radius-lg:     1rem;
  --va-2-radius-xl:     1.25rem;
  --va-2-radius-2xl:    1.5rem;

  /* Shadows — multi-layered, optional colored glow */
  --va-2-shadow-sm:     0 1px 2px rgba(0,0,0,0.40);
  --va-2-shadow-md:     0 4px 8px -2px rgba(0,0,0,0.40),
                        0 2px 4px -1px rgba(0,0,0,0.30);
  --va-2-shadow-lg:     0 20px 40px -16px rgba(0,0,0,0.50),
                        0 8px 16px -4px rgba(0,0,0,0.40);
  --va-2-shadow-glow:   0 20px 40px -20px var(--va-2-accent-glow);

  /* Typography scale — major third 1.250 */
  --va-2-text-xs:       0.75rem;
  --va-2-text-sm:       0.875rem;
  --va-2-text-base:     1rem;
  --va-2-text-lg:       1.125rem;
  --va-2-text-xl:       1.25rem;
  --va-2-text-2xl:      1.5rem;
  --va-2-text-3xl:      1.875rem;
  --va-2-text-4xl:      2.25rem;

  /* Motion */
  --va-2-duration-instant: 80ms;
  --va-2-duration-fast:    160ms;
  --va-2-duration-base:    240ms;
  --va-2-duration-slow:    400ms;
}

/* Light-mode overrides — same names, lighter values. */
html.light {
  --va-2-canvas:        #f6f7f9;
  --va-2-surface:       #ffffff;
  --va-2-surface-2:     #fafbfc;
  --va-2-surface-3:     #ffffff;

  --va-2-line:          rgba(15, 17, 21, 0.08);
  --va-2-line-strong:   rgba(15, 17, 21, 0.16);

  --va-2-text-strong:   #0f1115;
  --va-2-text:          #232831;
  --va-2-text-soft:     #4a4f5a;
  --va-2-text-faint:    #7a7f8a;

  --va-2-accent:        #4f46e5;
  --va-2-accent-strong: #4338ca;
  --va-2-shadow-sm:     0 1px 2px rgba(15,17,21,0.06);
  --va-2-shadow-md:     0 4px 12px -2px rgba(15,17,21,0.08),
                        0 2px 4px -1px rgba(15,17,21,0.04);
  --va-2-shadow-lg:     0 20px 40px -16px rgba(15,17,21,0.12),
                        0 8px 16px -4px rgba(15,17,21,0.08);
}

/*
 * Token re-bind: when v2 is active, the v1 names (--va-action etc.)
 * point to v2 values so components reading the v1 tokens
 * automatically pick up v2 colors. This is the entire mechanism
 * that makes existing components inherit v2 visuals without code
 * changes.
 */
html[data-theme-version="v2"] {
  --va-action:          var(--va-2-accent);
  --va-action-strong:   var(--va-2-accent-strong);
  --va-action-soft:     var(--va-2-accent-soft);

  --va-ink-950:         var(--va-2-canvas);
  --va-ink-900:         var(--va-2-surface);
  --va-ink-850:         var(--va-2-surface-2);
  --va-ink-800:         var(--va-2-surface-3);

  --va-line-soft:       var(--va-2-line);
  --va-line:            var(--va-2-line-strong);
  --va-line-strong:     var(--va-2-line-strong);

  --va-text-strong:     var(--va-2-text-strong);
  --va-text:            var(--va-2-text);
  --va-text-soft:       var(--va-2-text-soft);
  --va-text-faint:      var(--va-2-text-faint);

  --va-shadow-card:     var(--va-2-shadow-sm);
  --va-shadow-panel:    var(--va-2-shadow-md);
  --va-shadow-elevated: var(--va-2-shadow-lg);

  --va-panel-radius:    var(--va-2-radius-lg);
  --va-card-radius:     var(--va-2-radius-md);
  --va-control-radius:  var(--va-2-radius-md);

  /* Brighter accent presets when v2 is on. */
}

/* v2 accent preset re-tunes — same preset names, brighter values. */
html[data-theme-version="v2"] .va-app-shell[data-accent="teal"] {
  --va-2-accent:        #14b8a6;
  --va-2-accent-strong: #0d9488;
}
html[data-theme-version="v2"] .va-app-shell[data-accent="indigo"] {
  --va-2-accent:        #6366f1;
  --va-2-accent-strong: #4f46e5;
}
html[data-theme-version="v2"] .va-app-shell[data-accent="emerald"] {
  --va-2-accent:        #10b981;
  --va-2-accent-strong: #059669;
}
html[data-theme-version="v2"] .va-app-shell[data-accent="blue"] {
  --va-2-accent:        #3b82f6;
  --va-2-accent-strong: #2563eb;
}
html[data-theme-version="v2"] .va-app-shell[data-accent="slate"] {
  --va-2-accent:        #64748b;
  --va-2-accent-strong: #475569;
}
html[data-theme-version="v2"] .va-app-shell[data-accent="amber"] {
  --va-2-accent:        #f59e0b;
  --va-2-accent-strong: #d97706;
}
html[data-theme-version="v2"] .va-app-shell[data-accent="rose"] {
  --va-2-accent:        #f43f5e;
  --va-2-accent-strong: #e11d48;
}
```

- [ ] **Step 2: Run verify**

Run: `npm run verify 2>&1 | tail -5`
Expected: All 31+ checks pass. The new `verify-modules.theme-v2.mjs` from Task 1 is independent so it doesn't run here yet (we wire it in Task 5).

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds; `dist/index.html` ~1,594 kB (about +1.5 KB from baseline for the new CSS tokens — within budget).

- [ ] **Step 4: Verify default behavior is unchanged**

Open `dist/index.html` in a browser (or run `npm run preview`). The page should look **byte-identical** to main — same colors, same layout, same fonts. `<html>` should have `data-theme-version="v1"`.

You can manually flip to v2 in DevTools:
```js
localStorage.setItem("videoArchive:themeVersion", "v2");
location.reload();
```
After reload, `<html data-theme-version="v2">` should be set and you should see slightly different colors (darker canvas, brighter accent indigo). This is expected — PR B/D add the polish, but the cascade is already working.

- [ ] **Step 5: Commit**

```bash
git add src/styles/v2-identity.css src/main.js src/theme/applyInitialThemeVersion.js dist/index.html
git commit -m "feat(theme-v2): tokens + boot wiring (no visible change)

Adds v2-identity.css with ~180 lines of --va-2-* tokens covering
canvas, surfaces, text, accent presets, semantics, radii,
shadows, typography scale, and motion. v1 cascade is unchanged
because the data-theme-version attribute defaults to v1.

main.js now applies the attribute via applyInitialThemeVersion()
before applyInitialTheme() so React mounts with the cascade
already in place.

Manual override during development:
  localStorage.setItem('videoArchive:themeVersion', 'v2')
  location.reload()"
```

---

## Task 4: Settings field

**Files:**
- Modify: `src/stores/settingsDefaults.js` (around line 10-25)

- [ ] **Step 1: Read the current settingsDefaults.js**

```bash
cat src/stores/settingsDefaults.js
```

Look for the `ui` object literal inside `defaultSettings()`.

- [ ] **Step 2: Add the themeVersion field**

Edit `src/stores/settingsDefaults.js`. Inside the `ui` object literal, after the existing fields (e.g. after `firstTaskChoiceUsed: false`), add:

```js
      // Theme version — "v1" (classic Office-style) or "v2"
      // (modern Linear/Vercel-style). Defaults to v1 during the
      // rollout window so existing users don't get surprised on
      // upgrade. PR F flips this default once v2 is validated.
      themeVersion: "v1",
```

- [ ] **Step 3: Confirm no other code references this field yet**

Run: `grep -rn "themeVersion" src/ scripts/ --include="*.js" --include="*.jsx"`
Expected output:
```
src/stores/settingsDefaults.js: themeVersion: "v1",
src/theme/themeVersionStorage.js: ... (the module from Task 1)
scripts/verify-modules.theme-v2.mjs: ... (the test from Task 1)
```

No other references — the settings field is a placeholder for PR C (the picker UI) to read.

- [ ] **Step 4: Run verify + build**

Run: `npm run verify 2>&1 | tail -5 && npm run build 2>&1 | tail -5`
Expected: All checks pass, build succeeds, size unchanged from Task 3 (settings change is JS only and tree-shakable until someone reads `themeVersion`).

- [ ] **Step 5: Commit**

```bash
git add src/stores/settingsDefaults.js dist/index.html
git commit -m "feat(theme-v2): settings.ui.themeVersion field default v1

Adds the persisted setting that PR C's picker will read/write.
Defaults to v1 so the merge of this PR is a no-op for existing
users until they explicitly toggle.

The localStorage key (videoArchive:themeVersion from Task 1) is
the read path on boot. settings.ui.themeVersion is the persisted
copy in IndexedDB so v2 preference survives a localStorage clear.
The two stay in sync via the picker (PR C)."
```

---

## Task 5: Wire the theme-v2 tests into verify

**Files:**
- Modify: `scripts/verify-modules.mjs` (end of file)

- [ ] **Step 1: Read the verify-modules.mjs structure**

```bash
tail -10 scripts/verify-modules.mjs
```

Find the last `run(...)` call. We'll add the theme-v2 suite invocation after it.

- [ ] **Step 2: Append the theme-v2 suite invocation**

Edit `scripts/verify-modules.mjs`. At the very end of the file (after the last `run(...)` call), add:

```js
// Theme v2 storage tests — runs the standalone test suite from
// verify-modules.theme-v2.mjs in the same node process.
await import("./verify-modules.theme-v2.mjs");
```

- [ ] **Step 3: Run verify**

Run: `npm run verify 2>&1 | tail -10`
Expected: All existing checks pass PLUS the 5 theme-v2 storage tests pass:
```
ok - default version is v1
ok - normalize accepts v1 and v2 only
ok - storeThemeVersion writes to localStorage
ok - storeThemeVersion ignores invalid values
ok - storage key is namespaced
```

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-modules.mjs
git commit -m "test(theme-v2): wire theme-v2 storage tests into npm run verify

Imports verify-modules.theme-v2.mjs at the end of the main
verify script so the 5 storage tests run as part of the normal
verification gate."
```

---

## Final verification

- [ ] **Run the full verify + build one more time**

Run: `npm run verify 2>&1 | tail -10 && npm run build 2>&1 | tail -5`
Expected:
- Verify: all checks pass including the 5 new theme-v2 tests
- Build: `dist/index.html ~1,594 kB` (well within the +2KB budget)

- [ ] **Push the branch**

Run: `git push -u origin feat/theme-v2-pr-a-foundation`

- [ ] **Open the PR**

Run:
```bash
gh pr create --title "feat(theme-v2): foundation — tokens, settings field, boot wiring (PR A)" --body "$(cat <<'EOF'
## Summary

First of 6 PRs implementing the theme v2 visual refresh
described in \`docs/superpowers/specs/2026-05-28-theme-v2-design.md\`.

**Zero visible change for users on this PR.** The default
\`themeVersion\` is \`v1\` so the cascade keeps every existing
component pixel-identical. This PR's job is to ship the substrate
so PR B can land component classes and PR C can land the picker.

### What lands

- \`src/styles/v2-identity.css\` — ~180 lines of \`--va-2-*\`
  tokens (canvas, surfaces, text, 7 accent presets re-tuned for
  v2, semantic colors, radii, shadows, type scale, motion)
- \`src/theme/themeVersionStorage.js\` — localStorage helpers
  with strict \`v1|v2\` normalization
- \`src/theme/applyInitialThemeVersion.js\` — pre-React boot
  step that sets \`<html data-theme-version="v1|v2">\`
- \`src/stores/settingsDefaults.js\` gains \`ui.themeVersion: "v1"\`
- \`scripts/verify-modules.theme-v2.mjs\` — 5 tests covering
  default, normalization, write-read, invalid rejection, key
  namespacing. Wired into \`npm run verify\`.

### How to experiment with v2 locally

\`\`\`js
// In DevTools console:
localStorage.setItem("videoArchive:themeVersion", "v2");
location.reload();
\`\`\`

After reload, \`<html data-theme-version="v2">\` is set and v1
component CSS reads the v2 token values (darker canvas,
brighter accent, larger radii). PR B will add v2-only component
classes for the rest of the polish.

### Verified

- \`npm run verify\` — 31 existing checks + 5 new theme-v2 tests, all pass
- \`npm run build\` — 1.59 MB → 1.59 MB (+1.5 KB for new CSS)

## Test plan

- [x] Build + verify pass
- [ ] Manual: \`localStorage.setItem("videoArchive:themeVersion", "v1")\` → reload → app looks identical to main
- [ ] Manual: flip to v2 in localStorage → reload → \`<html>\` gets the attribute, colors shift subtly
- [ ] Manual: clear localStorage entirely → reload → app boots with v1 (default)
- [ ] Manual: try invalid value \`localStorage.setItem("...", "v9")\` → reload → app boots with v1 (normalized)
EOF
)"
```

- [ ] **Merge after the PR is green**

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
```

---

## Self-Review Checklist

Before declaring complete, verify:

1. **Spec coverage** — every section in the spec that PR A is responsible for is implemented:
   - [x] `src/styles/v2-identity.css` token file → Task 3
   - [x] `applyInitialThemeVersion` mechanism → Task 2
   - [x] `settings.ui.themeVersion` field → Task 4
   - [x] Default `"v1"` so no surprise on upgrade → Tasks 1 + 4
   - [ ] `src/assets/fonts/` woff2 files — **deferred to PR B** because binary commits complicate review, and the v2 type stack falls back gracefully to system fonts in PR A. PR B will add fonts alongside the first opt-in component class.

2. **Placeholder scan** — every step contains the actual code or command. The "deferred to PR B" font note above is the only deferral and is documented openly.

3. **Type consistency** — `THEME_VERSION_STORAGE_KEY`, `getStoredThemeVersion`, `normalizeThemeVersion`, `storeThemeVersion`, `DEFAULT_THEME_VERSION` referenced in Task 1 are all defined in the module body in the same task. `applyInitialThemeVersion` in Task 2 imports them correctly.

4. **Test coverage** — 5 tests verify the storage module. The boot wiring (`applyInitialThemeVersion`) is implicitly tested via the build + manual reload step; no DOM polyfill needed because the function is one line of `setAttribute`.

---

## What's next (out of scope for this plan)

PR B–F each get their own plan written after PR A merges. Brief outline so the eventual planner knows what's coming:

- **PR B (Component classes + fonts)**: add `.va-2-card`, `.va-2-primary-button`, `.va-2-input`, etc. as opt-in classes inside `v2-identity.css`. Add `src/assets/fonts/` woff2 files + `@font-face` declarations. Still no component opts in yet — adds the building blocks.

- **PR C (Picker UI + 30s preview)**: ship `src/features/settings/ThemeVersionPicker.jsx`. Mount it in `SettingsPage` appearance tab. Hook the picker to both the localStorage key (Task 1's module) and `settings.ui.themeVersion`. Add the 30-second preview countdown.

- **PR D (Component opt-ins)**: PageHero, primary buttons, cards conditionally render `.va-2-*` classes when `themeVersion === "v2"`. Most visible PR.

- **PR E (Motion + light mode polish)**: framer-motion spring presets, gradient refinements, light-mode shadow tuning, glassmorphism modal backdrop.

- **PR F (Default flip + banner)**: change `settingsDefaults.js` default to `"v2"`, add a one-shot "try v2" banner to existing users so they can opt in or stay on v1.
