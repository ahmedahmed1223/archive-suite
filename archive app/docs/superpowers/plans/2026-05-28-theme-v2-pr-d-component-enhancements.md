# Theme v2 — PR D (Component Enhancements) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Deliver the visible v2 payoff — gradient buttons, top-light cards with hover lift, cinematic page hero, gradient sidebar pill, accent focus rings — for the EXISTING component markup, active only when `themeVersion === "v2"`.

**Deliberate deviation from spec:** The spec proposed components conditionally render `.va-2-*` classes via JSX (`themeVersion === "v2" ? "va-2-card" : "va-card"`). Instead this PR uses **CSS attribute-scoping**: `html[data-theme-version="v2"] .va-card { …v2 treatment… }`. Same visual result, but **zero JSX changes**, fully reversible, and v1 stays byte-identical. The token rebinds from PR A already handle colors/radii/shadows globally; this PR adds the gradient/glow/lift flourishes that tokens alone can't express. Rationale: far less risk than touching dozens of components, and the whole PR is one CSS file append.

**Architecture:** Append a clearly-delimited "PR D — v2 component enhancements" block to `src/styles/v2-identity.css`. Every rule is prefixed `html[data-theme-version="v2"]` and uses `!important` where it must override v1's `!important` declarations (buttons/cards/hero use `!important` in v1-identity.css). v1 (no attribute or `="v1"`) is completely unaffected.

**Tech Stack:** Pure CSS. No JS, no build config changes.

**Prerequisite:** PR A/B/C merged. Confirm `src/styles/v2-identity.css` exists with `--va-2-*` tokens.

---

## File Structure

**Modify (1 file):** `src/styles/v2-identity.css` — append ~180 lines of scoped enhancements.

**Untouched:** all JSX, all other CSS, all logic.

---

## Pre-flight

```bash
git checkout main && git pull
git checkout -b feat/theme-v2-pr-d-component-enhancements
npm run build 2>&1 | tail -2   # baseline ~1,605.5 kB
```

---

## Task 1: Buttons + interactive controls

Append to END of `src/styles/v2-identity.css`:

```css

/* ===================================================================
 * PR D — v2 component enhancements (attribute-scoped).
 * Active only under html[data-theme-version="v2"]. v1 untouched.
 * Uses !important to override v1's !important declarations.
 * =================================================================== */

/* Primary buttons — gradient fill + glow + hover lift. */
html[data-theme-version="v2"] .va-primary-button,
html[data-theme-version="v2"] .va-action-button {
  background: linear-gradient(180deg, var(--va-2-accent), var(--va-2-accent-strong)) !important;
  border-color: transparent !important;
  border-radius: var(--va-2-radius-md) !important;
  box-shadow: var(--va-2-shadow-glow), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
  transition: transform var(--va-2-duration-fast) ease, box-shadow var(--va-2-duration-fast) ease !important;
}
html[data-theme-version="v2"] .va-primary-button:hover,
html[data-theme-version="v2"] .va-action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 25px 50px -20px var(--va-2-accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}
html[data-theme-version="v2"] .va-primary-button:active,
html[data-theme-version="v2"] .va-action-button:active {
  transform: translateY(0) scale(0.985);
}

/* Secondary + tool buttons — refined radius + accent hover border. */
html[data-theme-version="v2"] .va-secondary-button,
html[data-theme-version="v2"] .va-tool-button {
  border-radius: var(--va-2-radius-md) !important;
  transition: background var(--va-2-duration-fast) ease, border-color var(--va-2-duration-fast) ease !important;
}
html[data-theme-version="v2"] .va-secondary-button:hover,
html[data-theme-version="v2"] .va-tool-button:hover {
  border-color: color-mix(in srgb, var(--va-2-accent) 45%, transparent) !important;
}
```

Then: `npm run build 2>&1 | tail -2` (expect success, ~+0.7 KB), then commit:
```bash
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): gradient primary buttons + refined controls (PR D)

Attribute-scoped under html[data-theme-version=v2]. Primary/action
buttons get gradient fill + glow + hover lift; secondary/tool
buttons get larger radius + accent hover border. v1 untouched."
```

---

## Task 2: Cards, surfaces, page hero

Append to END of `src/styles/v2-identity.css`:

```css

/* Cards — top-light gradient overlay + hover lift + larger radius. */
html[data-theme-version="v2"] .va-card,
html[data-theme-version="v2"] .va-data-card,
html[data-theme-version="v2"] .va-video-card,
html[data-theme-version="v2"] .va-action-card,
html[data-theme-version="v2"] .va-preview-panel {
  border-radius: var(--va-2-radius-lg) !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 30%),
    var(--va-2-surface) !important;
  transition: transform var(--va-2-duration-fast) ease,
              border-color var(--va-2-duration-fast) ease,
              box-shadow var(--va-2-duration-fast) ease !important;
}
html[data-theme-version="v2"] .va-card:hover,
html[data-theme-version="v2"] .va-data-card:hover,
html[data-theme-version="v2"] .va-video-card:hover,
html[data-theme-version="v2"] .va-action-card:hover {
  transform: translateY(-2px);
  border-color: var(--va-2-line-strong) !important;
  box-shadow: var(--va-2-shadow-md) !important;
}

/* Metric cards — keep their existing gradient base but add v2 radius
 * and a soft accent-tinted top light. */
html[data-theme-version="v2"] .va-metric-card {
  border-radius: var(--va-2-radius-lg) !important;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--va-2-accent) 5%, transparent), transparent 45%),
    linear-gradient(180deg, var(--va-2-surface-2), var(--va-2-surface)) !important;
}

/* Page hero — cinematic multi-layer gradient. */
html[data-theme-version="v2"] .va-page-hero,
html[data-theme-version="v2"] .va-page-hero-compact,
html[data-theme-version="v2"] .va-panel-premium {
  border-radius: var(--va-2-radius-xl) !important;
  background:
    radial-gradient(circle at 85% 0%, color-mix(in srgb, var(--va-2-accent) 10%, transparent), transparent 40%),
    linear-gradient(160deg, var(--va-2-surface-2), var(--va-2-surface) 60%) !important;
}

/* Tinted surfaces — subtle gradient for depth. */
html[data-theme-version="v2"] .va-filter-surface,
html[data-theme-version="v2"] .va-control-surface,
html[data-theme-version="v2"] .va-tab-surface {
  border-radius: var(--va-2-radius-lg) !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent 50%),
    var(--va-2-surface) !important;
}
```

Then build + commit:
```bash
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): top-light cards + cinematic hero + tinted surfaces (PR D)

Cards get a subtle top-light gradient, hover lift, and larger
radius. Metric cards + page hero gain accent-tinted radial light.
Filter/control/tab surfaces get depth gradients. v2-scoped only."
```

---

## Task 3: Sidebar pill, inputs, chips, badges

Append to END of `src/styles/v2-identity.css`:

```css

/* Sidebar active item — full gradient pill instead of edge bar. */
html[data-theme-version="v2"] .va-sidebar-item-active {
  border-radius: var(--va-2-radius-md) !important;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--va-2-accent) 22%, transparent),
    color-mix(in srgb, var(--va-2-accent) 12%, transparent)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
}

/* Inputs — accent focus glow ring on main-area inputs. NOTE: in
 * this app the lock/login/onboarding gate screens render INSIDE
 * <main>, so they also receive the v2 focus ring when v2 is active.
 * That is intentional (consistent focus style once opted into v2). */
html[data-theme-version="v2"] main input:not([type="checkbox"]):not([type="radio"]):focus,
html[data-theme-version="v2"] main textarea:focus,
html[data-theme-version="v2"] main select:focus {
  border-color: var(--va-2-accent) !important;
  box-shadow: 0 0 0 3px var(--va-2-accent-glow) !important;
  outline: none !important;
}

/* Chips / tags / badges — larger radius, refined border. */
html[data-theme-version="v2"] .va-chip,
html[data-theme-version="v2"] .va-tag-chip,
html[data-theme-version="v2"] .va-category-pill,
html[data-theme-version="v2"] .va-status-badge,
html[data-theme-version="v2"] .va-count-badge {
  border-radius: var(--va-2-radius-sm) !important;
}

/* Floating action bar — elevated v2 surface with shadow. */
html[data-theme-version="v2"] .va-floating-action-bar {
  border-radius: var(--va-2-radius-xl) !important;
  box-shadow: var(--va-2-shadow-lg) !important;
}
```

Then verify + build + commit:
```bash
npm run verify 2>&1 | tail -5
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): sidebar pill + input focus ring + chip radii (PR D)

Active sidebar item becomes a gradient pill; main-area inputs get
an accent focus glow ring; chips/badges get larger radius; the
floating action bar gains an elevated shadow. v2-scoped only."
```

---

## Final verification

```bash
npm run verify 2>&1 | tail -8 && npm run build 2>&1 | tail -3
```
Expected: all pass; build < 1,609 kB.

**Manual smoke (critical for this PR):**
1. `npm run preview`, open app, Settings → المظهر → حديث
2. Walk every main page: Dashboard, Archive, Add, Detail, Types, Collections, Vocabulary, Users, Settings, DataCenter, SyncLog
3. Confirm: primary buttons are gradient + glow; cards lift on hover; page hero has accent radial; sidebar active item is a pill; inputs show glow ring on focus; nothing is broken/illegible
4. Toggle back to كلاسيكي → everything returns to v1 exactly
5. Toggle light mode + v2 → confirm gradients/shadows read correctly on light canvas

**Push + PR + merge:**
```bash
git push -u origin feat/theme-v2-pr-d-component-enhancements
gh pr create --title "feat(theme-v2): component enhancements — gradients, lift, cinematic hero (PR D)" --body "The visible v2 payoff. CSS attribute-scoped (zero JSX changes) — gradient buttons, top-light cards w/ hover lift, cinematic hero, gradient sidebar pill, accent focus rings. Active only under data-theme-version=v2; v1 byte-identical. Verify + build green."
gh pr merge --squash --delete-branch
git checkout main && git reset --hard origin/main
```

---

## Self-Review Checklist

1. **Spec coverage** — buttons ✓, cards ✓, metric cards ✓, hero ✓, sidebar pill ✓, inputs ✓, chips ✓, surfaces ✓. Deviation (CSS-scope vs JSX-opt-in) documented above.
2. **!important correctness** — every property that v1 marks `!important` (button bg/border/shadow, card bg/border/shadow) is also `!important` in the v2 override, so the higher-specificity v2 rule wins. Properties v1 does NOT mark important (transform, transition) don't strictly need it but including it is harmless.
3. **Scope isolation** — every selector starts with `html[data-theme-version="v2"]`. Grep the appended block: zero unscoped rules. NOTE: the gate screens (lock/login/onboarding) render inside `<main>`, so the input-focus rule reaches them too — intentional, gives a consistent v2 focus style once opted in (corrected from an earlier draft that wrongly assumed they sat outside `main`).
4. **Token references** — all `var(--va-2-*)` exist from PR A.
5. **Reversibility** — toggling back to v1 removes the attribute, so every rule deactivates. v1 visuals are guaranteed identical.

## What's next
- **PR E** — motion presets (framer-motion springs) + light-mode shadow tuning + glassmorphism modal backdrop
- **Fonts PR** — self-host Inter + IBM Plex Sans Arabic
- **PR F** — flip default to v2 + opt-in banner for existing users
