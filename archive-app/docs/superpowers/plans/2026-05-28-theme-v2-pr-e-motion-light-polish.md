# Theme v2 — PR E (Motion + Light-Mode Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Polish v2 with spring-like easing on interactions, a refined page-enter motion, glassmorphism modal backdrops, and light-mode corrections (the dark top-light gradients from PR D are invisible on white). All CSS, all v2-scoped, all behind the toggle.

**Architecture:** Append a "PR E — motion + light polish" block to `src/styles/v2-identity.css`. Three groups: (1) spring `cubic-bezier` easing on v2 interactive transitions + page-enter, (2) glassmorphism on dialog overlays/cards, (3) `html.light[data-theme-version="v2"]` overrides that swap the white top-light gradients for shadow-based depth and tune modal blur. Respects the existing `data-motion="off|reduced"` attribute (the v1 reduced-motion rules already cover all elements globally).

**Tech Stack:** Pure CSS. No JS, no framer-motion changes (the existing motion system + `data-motion` attribute stay authoritative).

**Prerequisite:** PR A–D merged.

---

## File Structure

**Modify (1 file):** `src/styles/v2-identity.css` — append ~90 lines.

**Untouched:** all JSX, all logic, v1.

---

## Pre-flight
```bash
git checkout main && git pull
git checkout -b feat/theme-v2-pr-e-motion-light-polish
npm run build 2>&1 | tail -2   # baseline ~1,609.4 kB
```

---

## Task 1: Spring easing + page-enter motion

Append to END of `src/styles/v2-identity.css`:

```css

/* ===================================================================
 * PR E — motion + light-mode polish (v2-scoped).
 * =================================================================== */

/* Spring-like easing curve for v2 interactions. Overshoots slightly
 * for a lively-but-controlled feel (Linear-style). */
html[data-theme-version="v2"] {
  --va-2-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --va-2-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}

/* Apply spring easing to the lift interactions added in PR D. */
html[data-theme-version="v2"] .va-primary-button,
html[data-theme-version="v2"] .va-action-button,
html[data-theme-version="v2"] .va-card,
html[data-theme-version="v2"] .va-data-card,
html[data-theme-version="v2"] .va-video-card,
html[data-theme-version="v2"] .va-action-card {
  transition-timing-function: var(--va-2-ease-spring) !important;
}

/* Page-enter — a slightly larger, smoother rise than v1. Honors the
 * global data-motion="off"/"reduced" rules already in v1-identity.css
 * (those use *::before/after blanket overrides with higher cascade). */
html[data-theme-version="v2"] .va-motion-page {
  animation: va-2-page-enter var(--va-2-duration-base) var(--va-2-ease-out) both;
}
@keyframes va-2-page-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
html[data-theme-version="v2"][data-motion="off"] .va-motion-page,
.va-app-shell[data-motion="off"] html[data-theme-version="v2"] .va-motion-page {
  animation: none;
}
```

Build + commit:
```bash
npm run build 2>&1 | tail -2
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): spring easing + page-enter motion (PR E)

Adds a spring cubic-bezier applied to v2 button/card lift
transitions, plus a smoother v2 page-enter keyframe. Honors the
existing data-motion=off/reduced settings. v2-scoped."
```

---

## Task 2: Glassmorphism modals

Append to END of `src/styles/v2-identity.css`:

```css

/* Glassmorphism modal backdrops + cards for v2. The base overlay
 * already blurs 10px; v2 deepens it and tints the card surface. */
html[data-theme-version="v2"] .va-dialog-overlay {
  background: rgba(2, 6, 23, 0.55) !important;
  backdrop-filter: blur(20px) saturate(1.1) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.1) !important;
}
html[data-theme-version="v2"] .va-dialog-card,
html[data-theme-version="v2"] [data-slot="dialog-content"],
html[data-theme-version="v2"] [data-slot="alert-dialog-content"] {
  border-radius: var(--va-2-radius-2xl) !important;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--va-2-accent) 6%, transparent), transparent 45%),
    var(--va-2-surface-2) !important;
  border: 1px solid var(--va-2-line-strong) !important;
  box-shadow: var(--va-2-shadow-lg) !important;
}

/* Dialog entry — scale + rise with spring easing. */
html[data-theme-version="v2"] .va-dialog-card {
  animation: va-2-dialog-in var(--va-2-duration-base) var(--va-2-ease-out) both;
}
@keyframes va-2-dialog-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.va-app-shell[data-motion="off"] html[data-theme-version="v2"] .va-dialog-card,
html[data-theme-version="v2"][data-motion="off"] .va-dialog-card {
  animation: none;
}
```

Build + commit:
```bash
npm run build 2>&1 | tail -2
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): glassmorphism modal backdrops (PR E)

v2 dialogs get a deeper 20px backdrop blur + saturate, an
accent-tinted surface-2 card with 2xl radius, and a spring
scale-in entry. Custom dialogs + Radix dialog/alert-dialog
content all covered. v2-scoped."
```

---

## Task 3: Light-mode v2 corrections

The top-light gradients added in PR D use `rgba(255,255,255,0.02)` — invisible on a white light-mode surface. Replace them with shadow-based depth in light mode, and soften the modal blur tint.

Append to END of `src/styles/v2-identity.css`:

```css

/* Light-mode v2 corrections — the white top-light gradients read as
 * nothing on a white canvas, so in light mode we drop them and lean
 * on borders + soft shadows for depth instead. */
html.light[data-theme-version="v2"] .va-card,
html.light[data-theme-version="v2"] .va-data-card,
html.light[data-theme-version="v2"] .va-video-card,
html.light[data-theme-version="v2"] .va-action-card,
html.light[data-theme-version="v2"] .va-preview-panel,
html.light[data-theme-version="v2"] .va-filter-surface,
html.light[data-theme-version="v2"] .va-control-surface,
html.light[data-theme-version="v2"] .va-tab-surface {
  background: var(--va-2-surface) !important;
  box-shadow: var(--va-2-shadow-sm);
}
html.light[data-theme-version="v2"] .va-card:hover,
html.light[data-theme-version="v2"] .va-data-card:hover,
html.light[data-theme-version="v2"] .va-video-card:hover,
html.light[data-theme-version="v2"] .va-action-card:hover {
  box-shadow: var(--va-2-shadow-md) !important;
}

/* Light-mode hero — softer accent radial over white. */
html.light[data-theme-version="v2"] .va-page-hero,
html.light[data-theme-version="v2"] .va-page-hero-compact,
html.light[data-theme-version="v2"] .va-panel-premium {
  background:
    radial-gradient(circle at 85% 0%, color-mix(in srgb, var(--va-2-accent) 8%, transparent), transparent 42%),
    var(--va-2-surface-2) !important;
}

/* Light-mode modal backdrop — lighter scrim, same blur. */
html.light[data-theme-version="v2"] .va-dialog-overlay {
  background: rgba(15, 17, 21, 0.28) !important;
}
```

Verify + build + commit:
```bash
npm run verify 2>&1 | tail -5
npm run build 2>&1 | tail -2
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): light-mode corrections for v2 surfaces (PR E)

The PR D white top-light gradients are invisible on a white
canvas — in light mode v2 now drops them and uses border + soft
shadow for depth, softens the hero accent radial, and lightens
the modal scrim. v2-scoped."
```

---

## Final verification
```bash
npm run verify 2>&1 | tail -8 && npm run build 2>&1 | tail -3
```
Expected: all pass; build < 1,613 kB.

**Manual smoke:**
1. v2 + dark: open any dialog (e.g. delete confirm) → deep blur backdrop, tinted card, scale-in
2. v2 + dark: navigate between pages → smooth rise enter; hover a card → spring lift
3. v2 + light: cards have soft shadow depth (not flat); hero has subtle accent wash; dialog scrim is light
4. Settings → data-motion off → confirm page-enter + dialog animations disabled
5. Toggle to v1 → none of this applies

**Push + PR + merge:**
```bash
git push -u origin feat/theme-v2-pr-e-motion-light-polish
gh pr create --title "feat(theme-v2): motion + glassmorphism + light-mode polish (PR E)" --body "Spring easing on v2 interactions, smoother page-enter, glassmorphism modal backdrops, and light-mode corrections (PR D top-light gradients were invisible on white). All CSS, v2-scoped, honors data-motion. Verify + build green."
gh pr merge --squash --delete-branch
git checkout main && git reset --hard origin/main
```

---

## Self-Review Checklist

1. **Scope** — every rule prefixed `html[data-theme-version="v2"]` or `html.light[data-theme-version="v2"]`. No v1 leak.
2. **Motion accessibility** — page-enter + dialog-in keyframes have explicit `animation: none` under `data-motion="off"`. The global v1 `data-motion="reduced"` blanket rule (`*` selector, `animation-duration: 0.12s`) also caps these because it has broad reach; confirm it still applies (it targets `.va-app-shell[data-motion] *`).
3. **Light-mode correctness** — white top-light gradients replaced by shadow depth; no white-on-white invisibility.
4. **Backdrop-filter fallback** — `-webkit-backdrop-filter` included for Safari. Browsers without support degrade to the solid scrim (still readable).
5. **Token validity** — `--va-2-ease-spring`, `--va-2-ease-out` defined in Task 1; all other tokens from PR A.

## What's next
- **Fonts PR** — self-host Inter + IBM Plex Sans Arabic (needs binary woff2 fetch)
- **PR F** — flip default to v2 + opt-in banner for existing users
