# Responsive Shell and Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide accessible, RTL-safe responsive navigation, notifications, and help surfaces across phone, tablet, and desktop widths.

**Architecture:** `AppHeader` owns navigation open state and keeps existing route data. CSS presents that navigation as a sidebar on wide screens and a Drawer on narrow screens. Notification data behavior stays unchanged; only its responsive surface and focus behavior change.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS custom properties, Vitest, Testing Library, Lucide.

## Global Constraints

- Preserve Arabic-first RTL behavior, routes, and role filtering.
- Add a failing behavior test before each production behavior change.
- Use existing design tokens and no new UI dependency.
- Use logical CSS properties and `100dvh` viewport guards.

---

### Task 1: Primary navigation

**Files:** `archive-next/components/AppHeader.tsx`, `archive-next/components/AppHeader.test.tsx`, `archive-next/app/styles/01-base.css`.

- [ ] Test opening, Escape closing, focus return, and trigger ARIA state.
- [ ] Run the test and observe it fail.
- [ ] Add one close callback, an overlay, explicit labels, and responsive sidebar/drawer styles.
- [ ] Run the component test and `pnpm --filter @archive/next typecheck`.

### Task 2: Notifications panel

**Files:** `archive-next/components/NotificationsPanel.tsx`, `archive-next/components/NotificationsPanel.test.tsx`, `archive-next/app/notifications/notifications.css`.

- [ ] Test Escape close and focus return from the bell dialog.
- [ ] Run the test and observe it fail.
- [ ] Add viewport-safe dimensions, independently scrollable list, and narrow-screen drawer styles.
- [ ] Run the component test and typecheck.

### Task 3: Help overflow guards

**Files:** `archive-next/app/styles/05-status.css`, `archive-next/lib/responsive-layout.test.ts`.

- [ ] Test that help and overlay CSS include viewport and inline-size guards.
- [ ] Run the test and observe it fail.
- [ ] Add logical max-width, overflow wrapping, and responsive spacing rules.
- [ ] Run affected tests, typecheck, and a Next.js build.
