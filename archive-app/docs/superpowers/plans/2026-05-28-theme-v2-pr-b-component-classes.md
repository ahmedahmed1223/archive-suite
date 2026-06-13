# Theme v2 — PR B (Component Classes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the opt-in v2 component classes (`.va-2-card`, `.va-2-primary-button`, `.va-2-secondary-button`, `.va-2-ghost-button`, `.va-2-input`, `.va-2-chip` + 4 semantic variants, `.va-2-surface` + `.va-2-surface-elevated`) to `v2-identity.css`. **No component opts in yet** — these are building blocks consumed in PR D. Zero visible change.

**Architecture:** All classes are appended to the existing `src/styles/v2-identity.css`. They reference the `--va-2-*` tokens shipped in PR A. Each class is scoped to be usable in BOTH theme versions (they read `--va-2-*` directly, so they look the same regardless of `data-theme-version` — but in practice only v2 components will use them). Pure additive CSS.

**Tech Stack:** Vite 7, vite-plugin-singlefile, CSS custom properties.

**Reference spec:** `docs/superpowers/specs/2026-05-28-theme-v2-design.md` (Components section)

**Prerequisite:** PR A merged (provides `--va-2-*` tokens). Confirm `src/styles/v2-identity.css` exists on `main` before starting.

---

## File Structure

**Modify (1 file):**
- `src/styles/v2-identity.css` — append a clearly-delimited "Component classes (PR B)" section (~150 lines)

**Untouched:** every other file. No JS, no components, no settings.

---

## Pre-flight

- [ ] **Confirm on main with PR A merged**

Run: `git checkout main && git pull && test -f src/styles/v2-identity.css && grep -c "va-2-accent" src/styles/v2-identity.css`
Expected: `git pull` up to date; file exists; grep count ≥ 1 (tokens present from PR A)

- [ ] **Create the branch**

Run: `git checkout -b feat/theme-v2-pr-b-component-classes`
Expected: `Switched to a new branch 'feat/theme-v2-pr-b-component-classes'`

- [ ] **Baseline build size**

Run: `npm run build 2>&1 | tail -3`
Expected: `dist/index.html  1,596.XX kB`. Record it.

---

## Task 1: Surface + card classes

**Files:**
- Modify: `src/styles/v2-identity.css` (append at end of file)

- [ ] **Step 1: Append surface + card classes**

Append to the END of `src/styles/v2-identity.css`:

```css

/* ===================================================================
 * Component classes (PR B) — opt-in v2 visual treatments.
 * Components apply these in PR D when themeVersion === "v2".
 * Until then they're inert (no element references them).
 * =================================================================== */

/* Surfaces with a subtle top-light gradient for depth. */
.va-2-surface {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 50%),
    var(--va-2-surface);
  border: 1px solid var(--va-2-line);
  border-radius: var(--va-2-radius-lg);
}
.va-2-surface-elevated {
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--va-2-accent) 4%, transparent), transparent 40%),
    var(--va-2-surface-2);
  border: 1px solid var(--va-2-line);
  border-radius: var(--va-2-radius-lg);
  box-shadow: var(--va-2-shadow-md);
}

/* Card — top-light gradient, hover lifts 2px with shadow. */
.va-2-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 30%),
    var(--va-2-surface);
  border: 1px solid var(--va-2-line);
  border-radius: var(--va-2-radius-lg);
  padding: 1.25rem;
  transition: transform var(--va-2-duration-fast) ease,
              border-color var(--va-2-duration-fast) ease,
              box-shadow var(--va-2-duration-fast) ease;
}
.va-2-card:hover {
  border-color: var(--va-2-line-strong);
  transform: translateY(-2px);
  box-shadow: var(--va-2-shadow-md);
}

/* Entity card — adds an accent stripe on the leading (RTL: right) edge.
 * Components pass --va-2-entity-accent inline for per-item colors. */
.va-2-entity-card {
  position: relative;
}
.va-2-entity-card::before {
  content: "";
  position: absolute;
  inset-inline-end: 0;
  top: 1rem;
  bottom: 1rem;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: var(--va-2-entity-accent, var(--va-2-accent));
  opacity: 0.6;
}
```

- [ ] **Step 2: Run verify + build**

Run: `npm run verify 2>&1 | tail -5 && npm run build 2>&1 | tail -3`
Expected: All checks pass; build succeeds; size grows ~0.5-1 KB.

- [ ] **Step 3: Commit**

```bash
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): surface + card component classes (PR B)

Adds .va-2-surface, .va-2-surface-elevated, .va-2-card, and
.va-2-entity-card with top-light gradients, hover lift, and an
RTL-aware accent stripe. Inert until components opt in (PR D)."
```

---

## Task 2: Button classes

**Files:**
- Modify: `src/styles/v2-identity.css` (append at end)

- [ ] **Step 1: Append button classes**

Append to the END of `src/styles/v2-identity.css`:

```css

/* Buttons — primary (gradient + glow), secondary (outlined),
 * ghost (transparent), danger (semantic red gradient). */
.va-2-primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(180deg, var(--va-2-accent), var(--va-2-accent-strong));
  color: #ffffff;
  border: none;
  border-radius: var(--va-2-radius-md);
  padding: 0.625rem 1.25rem;
  font-weight: 600;
  letter-spacing: -0.011em;
  box-shadow: var(--va-2-shadow-glow), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transition: transform var(--va-2-duration-fast) ease,
              box-shadow var(--va-2-duration-fast) ease;
}
.va-2-primary-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 25px 50px -20px var(--va-2-accent-glow),
              inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.va-2-primary-button:active {
  transform: translateY(0) scale(0.98);
}
.va-2-primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.va-2-secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--va-2-surface-2);
  color: var(--va-2-text-strong);
  border: 1px solid var(--va-2-line-strong);
  border-radius: var(--va-2-radius-md);
  padding: 0.625rem 1.25rem;
  font-weight: 600;
  transition: background var(--va-2-duration-fast) ease,
              border-color var(--va-2-duration-fast) ease;
}
.va-2-secondary-button:hover {
  background: var(--va-2-surface-3);
  border-color: var(--va-2-accent);
}

.va-2-ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--va-2-text-soft);
  border: none;
  border-radius: var(--va-2-radius-sm);
  padding: 0.5rem;
  transition: background var(--va-2-duration-fast) ease,
              color var(--va-2-duration-fast) ease;
}
.va-2-ghost-button:hover {
  background: var(--va-2-surface-2);
  color: var(--va-2-text-strong);
}

.va-2-danger-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(180deg, var(--va-2-danger), #dc2626);
  color: #ffffff;
  border: none;
  border-radius: var(--va-2-radius-md);
  padding: 0.625rem 1.25rem;
  font-weight: 600;
  transition: transform var(--va-2-duration-fast) ease;
}
.va-2-danger-button:hover {
  transform: translateY(-1px);
}
```

- [ ] **Step 2: Run verify + build**

Run: `npm run verify 2>&1 | tail -5 && npm run build 2>&1 | tail -3`
Expected: All pass; size grows ~1 KB.

- [ ] **Step 3: Commit**

```bash
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): button component classes (PR B)

Adds .va-2-primary-button (gradient + glow + lift), -secondary
(outlined), -ghost (icon buttons), and -danger (red gradient).
All honor disabled/hover/active states. Inert until PR D."
```

---

## Task 3: Input + chip classes

**Files:**
- Modify: `src/styles/v2-identity.css` (append at end)

- [ ] **Step 1: Append input + chip classes**

Append to the END of `src/styles/v2-identity.css`:

```css

/* Inputs — sunk-in feel (canvas deeper than surrounding surface),
 * accent focus ring. */
.va-2-input {
  width: 100%;
  background: var(--va-2-canvas);
  color: var(--va-2-text-strong);
  border: 1px solid var(--va-2-line);
  border-radius: var(--va-2-radius-md);
  padding: 0.625rem 0.875rem;
  min-height: 2.5rem;
  transition: border-color var(--va-2-duration-fast) ease,
              box-shadow var(--va-2-duration-fast) ease;
}
.va-2-input::placeholder {
  color: var(--va-2-text-faint);
}
.va-2-input:hover {
  border-color: var(--va-2-line-strong);
}
.va-2-input:focus {
  border-color: var(--va-2-accent);
  box-shadow: 0 0 0 3px var(--va-2-accent-glow);
  outline: none;
}

/* Chips/badges — base + 4 semantic variants. Each uses color-mix
 * so the tint reads correctly across all 7 accent presets. */
.va-2-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--va-2-surface-2);
  border: 1px solid var(--va-2-line);
  border-radius: var(--va-2-radius-sm);
  padding: 0.25rem 0.625rem;
  font-size: var(--va-2-text-xs);
  font-weight: 500;
  color: var(--va-2-text-soft);
}
.va-2-chip-accent {
  background: color-mix(in srgb, var(--va-2-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--va-2-accent) 25%, transparent);
  color: color-mix(in srgb, var(--va-2-accent) 35%, #ffffff);
}
.va-2-chip-success {
  background: color-mix(in srgb, var(--va-2-success) 12%, transparent);
  border-color: color-mix(in srgb, var(--va-2-success) 25%, transparent);
  color: color-mix(in srgb, var(--va-2-success) 35%, #ffffff);
}
.va-2-chip-danger {
  background: color-mix(in srgb, var(--va-2-danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--va-2-danger) 25%, transparent);
  color: color-mix(in srgb, var(--va-2-danger) 35%, #ffffff);
}
.va-2-chip-warning {
  background: color-mix(in srgb, var(--va-2-warning) 12%, transparent);
  border-color: color-mix(in srgb, var(--va-2-warning) 25%, transparent);
  color: color-mix(in srgb, var(--va-2-warning) 38%, #ffffff);
}
.va-2-chip-info {
  background: color-mix(in srgb, var(--va-2-info) 12%, transparent);
  border-color: color-mix(in srgb, var(--va-2-info) 25%, transparent);
  color: color-mix(in srgb, var(--va-2-info) 35%, #ffffff);
}

/* Light-mode chip text needs darker mix (white mix is invisible). */
html.light .va-2-chip-accent { color: color-mix(in srgb, var(--va-2-accent) 60%, #000000); }
html.light .va-2-chip-success { color: color-mix(in srgb, var(--va-2-success) 55%, #000000); }
html.light .va-2-chip-danger { color: color-mix(in srgb, var(--va-2-danger) 55%, #000000); }
html.light .va-2-chip-warning { color: color-mix(in srgb, var(--va-2-warning) 55%, #000000); }
html.light .va-2-chip-info { color: color-mix(in srgb, var(--va-2-info) 55%, #000000); }
```

- [ ] **Step 2: Run verify + build**

Run: `npm run verify 2>&1 | tail -5 && npm run build 2>&1 | tail -3`
Expected: All pass; size grows ~1.5 KB.

- [ ] **Step 3: Commit**

```bash
git add src/styles/v2-identity.css dist/index.html
git commit -m "feat(theme-v2): input + chip component classes (PR B)

Adds .va-2-input (sunk-in canvas bg + accent focus ring) and
.va-2-chip with accent/success/danger/warning/info variants
using color-mix tints that work across all 7 accent presets.
Light-mode overrides darken chip text for legibility. Inert
until PR D."
```

---

## Final verification

- [ ] **Full verify + build**

Run: `npm run verify 2>&1 | tail -8 && npm run build 2>&1 | tail -3`
Expected: All checks pass; build ~1,600 kB (PR A was 1,596.5; +~4 KB of component CSS is acceptable, total still well under any hard limit).

- [ ] **Confirm zero visible change**

The new classes are not referenced by any element. Open `dist/index.html` — app looks identical to PR A (which looks identical to v1 by default). Verify in DevTools that `.va-2-card` etc. exist in the stylesheet but match zero elements (`document.querySelectorAll('.va-2-card').length === 0`).

- [ ] **Push + PR**

```bash
git push -u origin feat/theme-v2-pr-b-component-classes
gh pr create --title "feat(theme-v2): component classes — surfaces, buttons, inputs, chips (PR B)" --body "Adds opt-in .va-2-* component classes consumed in PR D. Pure additive CSS, zero visible change (no element references them yet). Verify + build green."
```

- [ ] **Merge**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

## Self-Review Checklist

1. **Spec coverage** — every component class in the spec's "Components" section:
   - [x] `.va-2-surface` + `.va-2-surface-elevated` → Task 1
   - [x] `.va-2-card` + `.va-2-entity-card` → Task 1
   - [x] `.va-2-primary-button` / secondary / ghost / danger → Task 2
   - [x] `.va-2-input` → Task 3
   - [x] `.va-2-chip` + 5 variants → Task 3
   - [ ] Metric-card gradient-text, PageHero, Sidebar, Modal, Tabs treatments — **deferred to PR D** because those are component-specific compositions, not reusable classes. PR D builds them inline when the components opt in.
   - [ ] **Fonts** — deferred to their own PR (binary woff2 fetch). v2 falls back to system fonts gracefully.

2. **Placeholder scan** — every class has complete, real CSS. No TODOs.

3. **Token consistency** — every `var(--va-2-*)` reference matches a token defined in PR A's token block. Notably: `--va-2-accent-glow`, `--va-2-shadow-glow`, `--va-2-shadow-md`, `--va-2-radius-{sm,md,lg}`, `--va-2-text-xs`, `--va-2-duration-fast` all exist from PR A.

---

## What's next

- **PR C** — ThemeVersionPicker UI + 30s preview + main.js sync between localStorage and settings
- **PR D** — Components opt into `.va-2-*` classes when `themeVersion === "v2"` (the visible payoff)
- **PR E** — Motion presets + light-mode polish
- **Fonts PR** — fetch + self-host Inter + IBM Plex Sans Arabic woff2
- **PR F** — Flip default to v2 + opt-in banner
