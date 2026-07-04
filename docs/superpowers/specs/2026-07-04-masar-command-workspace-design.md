# Masar Command Workspace Design

## Goal

Build a modern Arabic-first UI/UX foundation for Masar that can become the canonical visual system for all Next.js pages: operational, warm, dense enough for archive work, and clear enough for daily users.

Reference concept image: [`masar-command-workspace-reference.png`](./masar-command-workspace-reference.png).

## Direction

The approved direction is **Functional Warm Command Workspace**. It blends a restrained operations console with Masar's warm archive identity:

- Enterprise-grade structure, not a marketing landing page.
- Arabic RTL as the primary layout direction.
- Right-side desktop sidebar, mobile bottom navigation/drawer behavior.
- Command/search-first workflows.
- Calm movement, strong states, and clear icons.

This is not a full rewrite of every page in one step. The first implementation wave creates the reusable foundation and applies it to the reference pages: dashboard, archive, and add archive. Remaining pages should then migrate to the same shell, toolbar, surface, and state patterns.

## Visual System

### Palette

- Background: warm ivory with subtle operational layering.
- Main surface: warm white.
- Text: charcoal/green-black with secondary muted olive-gray.
- Primary accent: archive green for create/save/open actions.
- Secondary accent: deep indigo for analytics, search, and tools.
- Warning: amber.
- Danger: restrained red.
- Dark mode: warm dark operations room, not direct inversion.

### Typography

- Keep local/system Arabic-friendly stack for now to avoid network/font risk.
- Use stronger hierarchy through size, weight, spacing, and consistent page headers.
- Page titles should be short Arabic nouns or actions: "الأرشيف", "إضافة مادة", "لوحة التشغيل".
- Supporting descriptions must explain the user outcome, not the implementation.

### Shape And Depth

- Radius stays restrained: 4px, 6px, 8px.
- Use borders and tonal surfaces before heavy shadows.
- Shadows are reserved for active sidebar item, drawers, command palette, and floating bulk action.
- No decorative blobs, large gradient hero blocks, or nested card stacks.

## Navigation

Desktop uses a right-side sidebar because the product is Arabic-first. Sidebar sections:

- العمل اليومي
- التنظيم
- المراقبة
- النظام

Each nav item has a small lucide icon and concise label. Active item is a strong green/indigo treatment. The top action row contains user/session, command palette, theme, and a primary "إضافة مادة" action.

Mobile keeps the same content model but prioritizes touch:

- Header with brand and action buttons.
- Menu reveals route groups.
- Important actions remain 44px+ touch targets.
- Tables must degrade to cards or horizontally safe surfaces.

## Page Model

Every operational page should follow this structure:

1. `AppShell`
2. `PageToolbar`
3. Optional `MetricStrip`
4. Main `DataSurface`
5. Optional `FilterRail`
6. Optional `InspectorPanel`
7. Unified loading/error/empty/success states

The first implementation wave updates:

- `/` Dashboard: command-center style with metrics, focus queue, recent records, jobs, and shortcuts.
- `/archive`: archive workspace with search/filter rail, view switcher, data surface, preview rail, and bulk actions.
- `/uploads`: add archive workspace with clearer wizard framing and supporting panels.

## Components

New or refined reusable components:

- `MetricStrip`: horizontal responsive metrics with icons and status tones.
- `WorkspacePanel`: surface wrapper for dense operation areas.
- `PageToolbar`: gains optional icon/variant support without breaking existing callers.
- `AppHeader`: icon navigation and primary action.
- `EmptyState`: icon-ready, action-ready state surface.

Components should use existing CSS tokens and local classes first. Do not introduce a new UI library or external font in this wave.

## Motion

Motion is subtle and functional:

- Page shell and panels fade/slide in very lightly.
- Sidebar active item and command surfaces transition quickly.
- Hover motion uses 1px lift only on actionable controls.
- Loading uses skeleton/quiet status surfaces.
- Respect `prefers-reduced-motion`.

## Accessibility

- Preserve semantic headings and landmarks.
- Keep all controls keyboard reachable.
- Maintain visible focus rings.
- Icon-only controls require labels or tooltips.
- Contrast should be safe in light/dark mode.
- Avoid tiny text in buttons/cards and avoid overflow on mobile.

## Testing

Required checks for the first wave:

- `pnpm --filter @archive/next run typecheck`
- `pnpm run build:next`
- `node scripts/verify-repo-hygiene.mjs`
- `git diff --check`

Visual smoke targets:

- `/`
- `/archive`
- `/uploads`
- `/files`
- `/types`
- `/settings`
- `/media/jobs`
- `/errors`

The first wave may not visually perfect every target, but it must not break layout, RTL, mobile, or dark mode.

## Self Review

- No placeholders remain.
- Scope is focused on the reusable foundation and three reference pages.
- The design preserves the existing Next/Laravel canonical path.
- The design avoids broad backend changes.
- Future page migration is explicit and can be tracked in tasks after this wave.
