# V15 Visual Regression Baselines (V15-VISUAL-004)

This document records the visual surfaces introduced or changed in V15 and the
acceptance criteria each must meet before the release gate passes. It is the
human-readable baseline; the automated `release:verify` gate (V15-REL-001)
treats a green run of the unit + a11y suites as the pass condition.

## Surfaces

| Surface | Route | RTL | LTR | Dark | Light | A11y |
| --- | --- | --- | --- | --- | --- | --- |
| Work inbox (grouped) | `/work-inbox` | ✅ | ✅ | ✅ | ✅ | grouped headings are `<h2>`, each group `aria-label` |
| Active filter bar | `/search` | ✅ | ✅ | ✅ | ✅ | `role=group` + per-chip remove `button` with labelled `aria-label` |
| Contextual resume link | `/work-inbox`, `/` | ✅ | ✅ | ✅ | ✅ | link text carries target label; hidden when stale (>30d) or same page |
| Search preview rail | `/search` | ✅ | ✅ | ✅ | ✅ | `aria-live=polite` announces preview changes |

## Tokens (must not be hard-coded)

All new surfaces use tokens from `app/styles/01-base.css` via `lib/visual-primitives.ts`:
`--radius-sm`, `--space-*`, `--color-bg-secondary/tertiary`, `--color-text-secondary/tertiary`.

## Acceptance gate

- [ ] `pnpm --dir archive-next test` green
- [ ] `tsc --noEmit` clean
- [ ] Manual RTL pass: group titles right-aligned, filter chips wrap correctly
- [ ] Manual a11y pass: keyboard reaches every chip remove + resume link; no console a11y warnings
- [ ] No new hard-coded color/spacing literals in V15 components
