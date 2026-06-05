# Theme v2 — Design Spec

**Status:** Approved · **Date:** 2026-05-28 · **Owner:** info@aqnetwork.net

## Problem

The current visual system (v1, "Ink Slate") is intentionally restrained
— small radii (6–12px), light shadows, refined-but-muted accents, Office
software vibe. It's professional but reads as *understated*.

The user wants the app to feel "more modern, contemporary, and beautiful"
— closer to Linear / Vercel / Stripe in aesthetic vocabulary. This spec
introduces a parallel theme v2 that ships alongside v1 with a settings
toggle, so users can opt in (or opt out) without risk of regression.

## Goals

- Land a visibly more modern look (gradients, colored shadows, larger
  radii, vibrant accents) without touching business logic
- Keep v1 alive as a fallback during the transition period
- Self-host Inter (Latin) + IBM Plex Sans Arabic (Arabic) so the visual
  upgrade survives the single-file production build
- Preserve every existing setting (accentColor, density, fontScale,
  motionLevel) — they all work in both themes
- Zero regression to keyboard nav, screen-reader support, RBAC, or
  audit behavior

## Non-Goals

- New features, new pages, new business logic
- Rewriting the store, slices, or services
- Replacing framer-motion or Tailwind
- Removing v1 in this spec (separate later spec once v2 adoption proves
  out)

## Decisions

### Direction
- **Aesthetic:** Linear / Vercel / Stripe — modern SaaS with soft
  gradients, multi-layered shadows, precise typography, calculated motion
- **Color philosophy:** Notion-style semantic colors (success/danger/
  warning/info) layered over a single configurable accent. The 7-accent
  *system* (teal/indigo/emerald/blue/slate/amber/rose) is carried into
  v2. The individual hex values are re-tuned for v2's brighter canvas
  — same names, more vibrant shades. Users keep their saved accent
  preference and see the v2 variant of it.
- **Density:** Roomy/Vercel as the default (`gap-16px`, `radius 12–16px`,
  colored shadows, gradient buttons). Existing density setting still
  toggles to compact for power users
- **Typography:** Self-hosted Inter + IBM Plex Sans Arabic via woff2.
  ~120KB compressed, acceptable for the single-file build
- **Implementation strategy:** Approach 1 — Theme v2 lives in parallel.
  A `data-theme-version` attribute on `<html>` switches CSS variable
  layers. v1 stays usable via Settings toggle

## Architecture

### File layout

**New:**
- `src/styles/v2-identity.css` — all v2 tokens and component styles,
  scoped to `:root[data-theme-version="v2"]` or `.va-2-*` classes
- `src/assets/fonts/` — four woff2 files (Inter Regular/Medium/SemiBold/
  Bold + IBM Plex Sans Arabic equivalents). `@font-face` declarations
  inside `v2-identity.css`
- `src/features/settings/ThemeVersionPicker.jsx` — settings card with
  v1/v2 radio + 30-second preview button
- (Optional) `docs/theme-v2.md` — user-facing changelog

**Edited:**
- `src/styles/app-overrides.css` — small v2-specific overrides; v1
  rules untouched
- `src/main.js` — read `settings.ui.themeVersion` on boot, set
  `<html data-theme-version="v1|v2">`
- `src/stores/settingsDefaults.js` — add `themeVersion: "v2"` default
  (new users) / `"v1"` (migration for existing users via a one-shot
  setting)
- `src/pages/SettingsPage.jsx` — mount `ThemeVersionPicker` in the
  appearance tab

**Not edited:** every slice, service, page-level business logic,
component logic. Visual changes flow through token replacement at the
CSS level.

### Token system

Every v1 token has a v2 sibling named `--va-2-*`. The cascade works
through the `<html>` data attribute:

```css
:root[data-theme-version="v2"] {
  --va-action: var(--va-2-accent);
  --va-line-soft: var(--va-2-line);
  /* ... */
}
```

So existing component CSS that reads `var(--va-action)` automatically
picks up the v2 value when the attribute is set. **No component code
needs to know about v1 vs v2** — pure token swap.

For component-level v2-only treatments (gradients, glow shadows,
multi-layer borders), v2 ships dedicated classes (`.va-2-card`,
`.va-2-primary-button`) that the components opt into via:

```jsx
const buttonClass = themeVersion === "v2" ? "va-2-primary-button" : "va-primary-button";
```

`themeVersion` is read once at the shell level and threaded through
context, OR read directly off `data-theme-version` via a small hook.

### Color tokens (dark mode)

| Purpose | v1 | v2 |
|---|---|---|
| Canvas | `#131418` | `#0a0b0e` |
| Surface | `#1d1f24` | `#14161b` |
| Surface-2 | `#232529` | `#1a1d24` |
| Surface-3 | `#2a2c31` | `#232830` |
| Text | `#d1d2d8` | `#a8acb8` |
| Text strong | `#f5f5f7` | `#f8f9fb` |
| Line soft | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.06)` |
| Accent (default indigo) | `#5b5fc7` | `#6366f1` |

### Radii

| Token | v1 | v2 |
|---|---|---|
| sm | 0.375rem | 0.5rem |
| md (default control) | 0.5rem | 0.75rem |
| lg (cards) | 0.75rem | 1rem |
| xl (hero) | — | 1.25rem |
| 2xl (modals) | — | 1.5rem |

### Shadows

v2 adds **colored shadows** on focus + on primary CTA buttons:

```
--va-2-shadow-md: 0 4px 8px -2px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.3)
--va-2-shadow-lg: 0 20px 40px -16px rgba(0,0,0,0.5), 0 8px 16px -4px rgba(0,0,0,0.4)
--va-2-shadow-glow: 0 20px 40px -20px var(--va-2-accent-glow)
```

### Typography

```
font-family: "Inter", "IBM Plex Sans Arabic", ui-sans-serif, system-ui;
font-feature-settings: "cv02","cv03","cv04","cv11","ss01";
letter-spacing: -0.011em;
```

Type scale (1.250 ratio Major Third): `xs 0.75 → 4xl 2.25rem`. Line
heights tuned per step (1.6 body, 1.25 hero).

### Surfaces with gradients

```css
.va-2-surface {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.02), transparent 50%),
    var(--va-2-surface);
}
.va-2-surface-elevated {
  background:
    radial-gradient(circle at top, rgba(99,102,241,0.04), transparent 40%),
    var(--va-2-surface-2);
}
```

A subtle top-light effect adds depth without going full glassmorphism.

## Components

### PageHero
Height: ~140px (was ~100px). Triple-layer background:
1. Radial accent glow from top (4% opacity)
2. Linear diagonal sweep
3. Solid base surface

Icon inside a 48×48 tile with accent gradient. Title `text-3xl`,
tight tracking, weight 600. Subtitle `text-base text-soft max-w-2xl`.
Actions: gradient primary button.

### Buttons
- **Primary**: linear-gradient (accent → accent-strong) + inset
  highlight + glow shadow. `radius-md`. Hover lifts 1px + glow
  expands. Active scales to 0.97.
- **Secondary**: `surface-2` background + `line-strong` border.
- **Ghost**: transparent → `surface-2` on hover. `radius-sm`. For
  icon-only buttons.
- **Destructive**: gradient red, same shape as primary.

### Cards
`va-2-card`: subtle top-light gradient, `radius-lg`, hover lifts 2px
+ `shadow-md`. Entity cards (videos, collections, types) add an
accent-colored stripe on the leading edge.

Metric cards apply a gradient-text effect to the headline number
(`-webkit-background-clip: text` from `text-strong` to `text-soft`).

### Inputs
Background uses `canvas` (deeper than surrounding surface) for a
"sunk in" feel. Focus state: `radius-md`, accent border + 3px glow
ring. Min-height 2.5rem (40px) on desktop, bumped to 44px on mobile
via existing PR #46 rule.

### Sidebar
Width 240px (was 280px). Active nav item: full gradient pill (not
border-right). Icons 18px inside h-7 tile. Group labels
`text-[10px] tracking-wider uppercase text-faint`. Bottom user
widget gets a gradient border.

### Tabs (Settings, DataCenter)
Horizontal scroll bar below lg (PR #43 stays). Each tab: pill
shape, active state has gradient + accent glow. framer-motion
`layoutId="settings-tab-active"` keeps the slide animation in both
modes.

### Modals
Backdrop: `rgba(2,6,23,0.7)` + `backdrop-blur(20px)`. Card
`surface-2` + `shadow-lg` + `radius-2xl`. Entry animation: opacity
+ scale(0.96 → 1) + translate (0,8 → 0) over 240ms.

### Badges/Chips
Base + 5 variants (accent, success, danger, warning, info). Each
uses `color-mix(...12%, transparent)` for bg and `color-mix(...25%,
transparent)` for border, producing a tinted-but-readable chip
across all 7 accent presets.

## Motion

**Philosophy:** Linear-style calculated motion — every animation
has a reason, zero decoration.

### Spring presets (framer-motion)
- **SPRING_SOFT** `{ stiffness: 180, damping: 22 }` — hover lift,
  pill slide, dialog enter
- **SPRING_SNAPPY** `{ stiffness: 360, damping: 28 }` — toggles,
  switches, dialog snap
- **SPRING_BOUNCY** `{ stiffness: 280, damping: 18 }` — playful
  micro-interactions only (rare)

### Durations
- **instant** 80ms — tap feedback (scale 0.97)
- **fast** 160ms — hover, focus border
- **base** 240ms — page transitions, dialog open
- **slow** 400ms — celebratory moments (rare)

### prefers-reduced-motion
All springs collapse to 120ms ease-out. `data-motion="off"`
collapses to 0ms (existing setting honored).

## Toggle UX

Settings → المظهر gains a new section "إصدار الواجهة":

```
┌──────────────────────────────────────────┐
│  إصدار الواجهة                            │
│  ────────────────────────────────────    │
│  ○ كلاسيكي (v1)                           │
│      Office-style، مكتوم ومحترف             │
│                                           │
│  ● حديث (v2) — جديد                       │
│      Linear/Vercel-style، gradients +     │
│      shadows ملوّنة + spring motion         │
│                                           │
│  [ معاينة v2 لمدة 30 ثانية ]              │
└──────────────────────────────────────────┘
```

- Storage: `settings.ui.themeVersion: "v1" | "v2"`
- Default during rollout (PRs A–E): `"v1"` for everyone, so no
  visible change until users opt in via the picker
- Default after PR F (post-validation): `"v2"` for fresh installs
  + a banner offering v2 to existing users (they keep v1 unless
  they accept)
- Apply: `main.js` reads it on boot and sets `<html
  data-theme-version="v2">`
- 30-second preview: applies v2 temporarily with countdown; user
  chooses "احتفظ" or "ارجع لـ v1"

## Light mode (v2)

Same approach with a lighter palette:
- canvas `#f6f7f9`, surface `#ffffff`, surface-2 `#fafbfc`
- text `#0f1115`, text-soft `#4a4f5a`
- accent darkens slightly (`#4f46e5` for indigo) for AA contrast
- shadows in light mode use slate-tinted rgba instead of pure black
- Glassmorphism modals (`backdrop-blur(20px)`) shine in light mode

## Accessibility (preserved from v1)

- WCAG AA contrast on every text/background combination, verified
  via axe-core
- 44×44 touch targets on mobile (PR #46 rule)
- `focus-visible`: 3px ring in accent color, offset 2px
- `prefers-reduced-motion`: springs collapse to ease 120ms
- `aria-pressed` on toggles, `role="tablist"` on tabs, all carried
  forward

## Performance

- Self-hosted fonts subset to Latin + Arabic core glyphs:
  ~30KB/weight × 4 weights = ~120KB total
- woff2 inline via `vite-plugin-singlefile` adds to the bundle but
  eliminates network requests
- Total bundle estimated impact: 1.59MB → 1.72MB (+8%)
- No additional JS — v2 is pure CSS + the picker component (~50
  lines)

## File changes summary

**New files (4):**
- `src/styles/v2-identity.css`
- `src/assets/fonts/Inter-{Regular,Medium,SemiBold,Bold}.woff2`
- `src/assets/fonts/IBMPlexSansArabic-{Regular,Medium,SemiBold,Bold}.woff2`
- `src/features/settings/ThemeVersionPicker.jsx`

**Edited files (4):**
- `src/styles/app-overrides.css` — add v2-scoped overrides
- `src/main.js` — read + apply themeVersion
- `src/stores/settingsDefaults.js` — add themeVersion field
- `src/pages/SettingsPage.jsx` — mount picker in appearance tab

**Untouched:** every other file. Components opt into `va-2-*`
classes incrementally as authors visit them; until then they
inherit the token-level changes via `var(--va-action)` etc.

## Migration plan

1. **PR A — Foundation**: ship `v2-identity.css` (tokens only, no
   component classes), fonts, settings field, default `"v1"` so
   no visible change. Verify v1 still pixel-identical.
2. **PR B — Component classes**: add `.va-2-*` classes inside
   `v2-identity.css`. Still no behavior change because no
   component opts in yet.
3. **PR C — Toggle UX**: `ThemeVersionPicker` + main.js wiring +
   30s preview. After this, users can manually flip the switch
   and see v2.
4. **PR D — Component opt-ins**: PageHero, primary buttons, cards
   pick up `va-2-*` classes when `themeVersion === "v2"`. Most
   visible change.
5. **PR E — Polish**: motion presets, gradient refinements, light
   mode tuning.
6. **PR F (later)**: flip default to `"v2"` for fresh installs
   after we've validated.

Each PR is independently mergeable with `npm run verify + build`
passing and zero behavior changes for v1 users.

## Open questions

None — every decision above is locked. Implementation plan will
sequence the 6 PRs in writing-plans skill output.
