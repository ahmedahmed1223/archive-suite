# Masar Command Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first modern Masar UI/UX foundation and apply it to the dashboard, archive, and add archive pages.

**Architecture:** Keep the existing Next.js App Router and CSS-token system. Extend shared shell, navigation, page toolbar, and state/surface classes so later pages can migrate without a second design language.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS custom properties, lucide-react, existing local UI components.

---

### Task 1: Shell And Navigation Foundation

**Files:**
- Modify: `archive-next/lib/navigation.ts`
- Modify: `archive-next/components/AppHeader.tsx`
- Modify: `archive-next/app/theme.css`
- Modify: `archive-next/app/globals.css`

- [x] Add icons and shorter section labels to navigation.
- [x] Render nav icons in `AppHeader` using lucide-react.
- [x] Add a primary "إضافة مادة" action in the header action row.
- [x] Add missing token aliases used by current CSS: `--shadow-xs`, `--color-shadow`, `--color-danger`, `--color-text-muted`.
- [x] Update sidebar styling to feel like a right-side operations console while preserving mobile behavior.
- [x] Verify with `pnpm --filter @archive/next run typecheck`.

### Task 2: Shared Page Surfaces

**Files:**
- Modify: `archive-next/components/PageToolbar.tsx`
- Modify: `archive-next/components/EmptyState.tsx`
- Create: `archive-next/components/MetricStrip.tsx`
- Modify: `archive-next/app/globals.css`

- [x] Add optional `icon`, `tone`, and `density` props to `PageToolbar`.
- [x] Add optional icon support to `EmptyState`.
- [x] Create `MetricStrip` for responsive metrics with lucide icons.
- [x] Add CSS for command workspace surfaces, metric strips, filter rails, inspector panels, and skeleton states.
- [x] Verify with `pnpm --filter @archive/next run typecheck`.

### Task 3: Dashboard Reference Page

**Files:**
- Modify: `archive-next/app/page.tsx`

- [x] Rework dashboard content into a command workspace: hero-free toolbar, metrics, attention queue, recent records, jobs, and shortcuts.
- [x] Use `MetricStrip` and shared states.
- [x] Keep existing API calls and independent widget failure behavior.
- [x] Verify with `pnpm --filter @archive/next run typecheck`.

### Task 4: Archive Reference Page

**Files:**
- Modify: `archive-next/app/archive/page.tsx`
- Modify: `archive-next/app/archive/archive.module.css`
- Modify: `archive-next/app/globals.css`

- [x] Convert archive layout into a three-part workspace: filter rail, data surface, inspector rail.
- [x] Keep all current search/filter/view/bulk behavior.
- [x] Improve labels and visual density without removing features.
- [x] Verify with `pnpm --filter @archive/next run typecheck`.

### Task 5: Add Archive Reference Page

**Files:**
- Modify: `archive-next/app/uploads/page.tsx`
- Modify: `archive-next/app/globals.css`

- [x] Reframe uploads as "إضافة مادة" with step-oriented layout and clear supporting panels.
- [x] Preserve `UploadForm`, URL import, intake templates, and upload links.
- [x] Add a shared add-workspace layout around the existing panels.
- [x] Verify with `pnpm --filter @archive/next run typecheck`.

### Task 6: Final Verification And Commit

**Files:**
- Review all changed files.

- [x] Run `pnpm --filter @archive/next run typecheck`.
- [x] Run `pnpm run build:next`.
- [x] Run `node scripts/verify-repo-hygiene.mjs`.
- [x] Run `git diff --check`.
- [x] Commit on `master` with `feat: add masar command workspace ui`.

## Self Review

- The plan covers the approved design foundation and the three reference pages.
- No backend/API changes are required.
- No placeholders remain.
- Tasks are scoped so the implementation is testable and can be extended page-by-page later.
