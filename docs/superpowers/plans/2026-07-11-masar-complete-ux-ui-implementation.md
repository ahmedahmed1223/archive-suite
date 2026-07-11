# Masar Complete UX/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تحويل واجهات Masar إلى رحلة عربية تشغيلية متجاوبة ومترابطة من أول تشغيل حتى النقل والمعالجة والأرشفة والإدارة.

**Architecture:** نبني فوق `AppShell` والمكونات الحالية، ونضيف طبقة أنماط Mobile-First مشتركة ثم نرحّل الصفحات في شرائح رأسية حسب رحلة المستخدم. لا نضيف مكتبة UI أو خدمة خارجية؛ كل شريحة تختبر السلوك المشترك وتوثق النتيجة في `CHANGELOG.md` ثم تُدمج بعملية commit مستقلة.

**Tech Stack:** Next.js 16 App Router، React 19، TypeScript، CSS custom properties، Radix primitives الموجودة، Lucide، Vitest، Laravel API الحالي.

## Global Constraints

- المسار القانوني للتطوير هو `archive-next/` و`archive-laravel/` فقط؛ لا ميزات جديدة في legacy.
- الواجهة عربية RTL أولاً، وتعمل دون تمرير أفقي عند 375×812 و768×1024 و1280×800.
- فلسفة التصميم: Functional Warm Command Workspace؛ حدود وسطوح لونية قبل الظلال، وحركة وظيفية هادئة.
- لا مكتبة UI جديدة، لا خط خارجي، لا Sentry، ولا تسجيل دخول خارجي.
- أهداف اللمس 44px على الأقل، نص الحقول 16px على الهاتف، WCAG AA، وتركيز لوحة مفاتيح واضح.
- كل شريحة تبدأ باختبار يفشل، ثم أقل تنفيذ ينجحه، ثم typecheck/tests/build، ثم تحديث `CHANGELOG.md` وcommit.

---

### Task 1: Responsive RTL Foundation

**Files:**
- Modify: `archive-next/app/styles/01-base.css`
- Modify: `archive-next/app/styles/02-layout.css`
- Modify: `archive-next/app/styles/08-foundation.css`
- Modify: `archive-next/components/AppShell.tsx`
- Modify: `archive-next/components/AppHeader.tsx`
- Modify: `archive-next/components/WorkspaceCommandBar.tsx`
- Test: `archive-next/lib/responsive-layout.test.ts`

**Interfaces:**
- Produces: shared classes `.app-shell`, `.app-content`, `.workspace-commandbar`, `.mobile-primary-nav` that never exceed the viewport.

- [ ] Write a failing source-contract test asserting `min-inline-size: 0`, `max-inline-size: 100%`, `overflow-x: clip`, mobile-first shell rules, and 44px controls.
- [ ] Run `pnpm --filter @archive/next exec vitest run lib/responsive-layout.test.ts` and confirm RED.
- [ ] Implement the shared CSS and minimal semantic/data attributes needed by the test.
- [ ] Run the focused test, full Next tests, typecheck, and build; confirm GREEN.
- [ ] Capture `/first-run`, `/uploads`, `/archive` at 375/768/1280 and verify no horizontal displacement.
- [ ] Update `CHANGELOG.md` and commit `fix: harden responsive rtl workspace shell`.

### Task 2: Role-Focused Navigation and Unified Page States

**Files:**
- Modify: `archive-next/lib/navigation.ts`
- Modify: `archive-next/components/AppHeader.tsx`
- Modify: `archive-next/components/MobilePrimaryNav.tsx`
- Modify: `archive-next/components/PageToolbar.tsx`
- Modify: `archive-next/components/EmptyState.tsx`
- Create: `archive-next/components/AsyncStateSurface.tsx`
- Test: `archive-next/lib/navigation.test.ts`
- Test: `archive-next/lib/page-state-contract.test.ts`

**Interfaces:**
- Produces: `getDailyNavigation(section, role)` and `AsyncStateSurface` with loading, empty, error, success and retry contracts.

- [ ] Write failing tests for daily navigation, grouped “more” routes, sibling active states, and actionable async states.
- [ ] Run focused tests and confirm RED for missing APIs.
- [ ] Implement role-focused navigation while retaining command-palette access to all routes.
- [ ] Implement unified state surfaces with one primary action and an accessible live region.
- [ ] Run tests/typecheck/build and capture desktop/mobile navigation.
- [ ] Update `CHANGELOG.md` and commit `feat: simplify navigation and page states`.

### Task 3: First Run, Login, Settings, Help and Health Journey

**Files:**
- Modify: `archive-next/app/first-run/page.tsx`
- Modify: `archive-next/app/login/page.tsx`
- Modify: `archive-next/app/settings/page.tsx`
- Modify: `archive-next/app/settings/users/page.tsx`
- Modify: `archive-next/app/help/page.tsx`
- Modify: `archive-next/app/status/page.tsx`
- Modify: `archive-next/app/system/control/page.tsx`
- Create: `archive-next/lib/setup-journey.ts`
- Test: `archive-next/lib/setup-journey.test.ts`

**Interfaces:**
- Produces: `deriveSetupJourney(health, session, preferences)` returning current step, completed steps, next action and readiness percentage.

- [ ] Write failing tests for incomplete server, authenticated healthy server, skipped expert flow, and recovery action.
- [ ] Implement the pure setup journey model.
- [ ] Refactor first-run into four progressive steps with automatic checks and a clear next action.
- [ ] Connect login errors, settings tests, help context, status remediation, and system-control result links to the same journey language.
- [ ] Run focused/full tests, typecheck/build, and responsive smoke checks.
- [ ] Update `CHANGELOG.md` and commit `feat: connect first run setup journey`.

### Task 4: Add Material, Inbox, Ingest and Processing Journey

**Files:**
- Modify: `archive-next/app/uploads/page.tsx`
- Modify: `archive-next/app/uploads/UploadForm.tsx`
- Modify: `archive-next/app/uploads/ImportFromUrlForm.tsx`
- Modify: `archive-next/app/uploads/IntakeTemplatesPanel.tsx`
- Modify: `archive-next/app/uploads/UploadLinksPanel.tsx`
- Modify: `archive-next/app/inbox/page.tsx`
- Modify: `archive-next/app/ingest/page.tsx`
- Modify: `archive-next/app/media/jobs/page.tsx`
- Modify: `archive-next/app/transcriber/page.tsx`
- Modify: `archive-next/app/files/page.tsx`
- Create: `archive-next/lib/intake-journey.ts`
- Test: `archive-next/lib/intake-journey.test.ts`

**Interfaces:**
- Produces: persisted draft state, file-level progress model, `deriveIntakeNextAction`, and consistent status labels used by all intake pages.

- [ ] Write failing tests for draft recovery, duplicate warning, partial file failure, review readiness, and next-step derivation.
- [ ] Implement the pure journey/draft model using local storage adapters outside the pure module.
- [ ] Make `/uploads` a full-width primary wizard; collapse supporting tools and show file-level progress/retry.
- [ ] Add triage states to inbox, preflight/mapping/dry-run to ingest, recoverable job timeline, searchable media selection for transcription, and relationship warnings for file moves.
- [ ] Run focused/full tests, typecheck/build and responsive screenshots for all six pages.
- [ ] Update `CHANGELOG.md` and commit `feat: unify intake and processing journey`.

### Task 5: Archive, Search and Record Workspace

**Files:**
- Modify: `archive-next/app/page.tsx`
- Modify: `archive-next/app/archive/page.tsx`
- Modify: `archive-next/app/archive/[id]/page.tsx`
- Modify: `archive-next/app/search/page.tsx`
- Modify: `archive-next/app/search/saved/page.tsx`
- Modify: `archive-next/app/discover/page.tsx`
- Modify: `archive-next/app/favorites/page.tsx`
- Modify: `archive-next/app/reading-lists/page.tsx`
- Modify: `archive-next/app/timeline/page.tsx`
- Modify: `archive-next/app/graph/page.tsx`
- Modify: `archive-next/app/catalog/page.tsx`
- Create: `archive-next/lib/workspace-preferences.ts`
- Test: `archive-next/lib/workspace-preferences.test.ts`

**Interfaces:**
- Produces: safe local preferences for filters, columns, density, preview state and last workspace position.

- [ ] Write failing tests for preference migration, invalid persisted values, route-scoped filters, and new-result counts.
- [ ] Implement preference parsing and persistence adapters.
- [ ] Apply stable filters, chips, preview rail/bottom sheet, contextual next action, and restored position across library pages.
- [ ] Refactor record detail into summary/data/files/review/rights/history sections without changing backend contracts.
- [ ] Run tests/typecheck/build and responsive visual checks.
- [ ] Update `CHANGELOG.md` and commit `feat: improve archive discovery workspace`.

### Task 6: Organization and Quality Workspaces

**Files:**
- Modify: `archive-next/app/collections/page.tsx`
- Modify: `archive-next/app/types/page.tsx`
- Modify: `archive-next/app/vocabulary/page.tsx`
- Modify: `archive-next/app/tags/page.tsx`
- Modify: `archive-next/app/duplicates/page.tsx`
- Modify: `archive-next/app/kanban/page.tsx`
- Modify: `archive-next/app/projects/page.tsx`
- Create: `archive-next/lib/change-impact.ts`
- Test: `archive-next/lib/change-impact.test.ts`

**Interfaces:**
- Produces: change-impact summaries used before schema, tag, duplicate and workflow mutations.

- [ ] Write failing tests for affected-record counts, destructive impact wording, reversible actions, and safe no-impact changes.
- [ ] Implement the pure impact model.
- [ ] Add previews, impact summaries, versions/undo where supported, and accessible alternatives to drag-and-drop.
- [ ] Run tests/typecheck/build and responsive checks.
- [ ] Update `CHANGELOG.md` and commit `feat: clarify organization change impact`.

### Task 7: Media Review, Collaboration, Automation and Rights

**Files:**
- Modify: `archive-next/app/media/play/page.tsx`
- Modify: `archive-next/app/media/review/page.tsx`
- Modify: `archive-next/app/media/compare/page.tsx`
- Modify: `archive-next/app/collaboration/page.tsx`
- Modify: `archive-next/app/broadcast/page.tsx`
- Modify: `archive-next/app/automation/page.tsx`
- Modify: `archive-next/app/copilot/page.tsx`
- Modify: `archive-next/app/rights/page.tsx`
- Create: `archive-next/lib/operational-safety.ts`
- Test: `archive-next/lib/operational-safety.test.ts`

**Interfaces:**
- Produces: safety summary and confirmation requirements for broadcast, automation, AI suggestions, rights and version decisions.

- [ ] Write failing tests for dry-run, high-impact confirmation, blocked-rights state, confidence disclosure, and audit link.
- [ ] Implement operational safety derivation.
- [ ] Apply synchronized media controls, focused review states, collaboration conflict recovery, broadcast preflight, rule previews and rights risk indicators.
- [ ] Run tests/typecheck/build and responsive checks.
- [ ] Update `CHANGELOG.md` and commit `feat: strengthen review and operational safety`.

### Task 8: Sharing, Observability and Administration

**Files:**
- Modify: `archive-next/app/shares/page.tsx`
- Modify: `archive-next/app/shares/with-me/page.tsx`
- Modify: `archive-next/app/share/[token]/page.tsx`
- Modify: `archive-next/app/review/[token]/page.tsx`
- Modify: `archive-next/app/activity/page.tsx`
- Modify: `archive-next/app/analytics/page.tsx`
- Modify: `archive-next/app/reports/page.tsx`
- Modify: `archive-next/app/errors/page.tsx`
- Modify: `archive-next/app/backup/page.tsx`
- Modify: `archive-next/app/plugins/page.tsx`
- Modify: `archive-next/app/notifications/page.tsx`
- Create: `archive-next/lib/admin-action-summary.ts`
- Test: `archive-next/lib/admin-action-summary.test.ts`

**Interfaces:**
- Produces: redacted summaries, preview-before-export/share, safe destructive confirmation and actionable observability states.

- [ ] Write failing tests for secret redaction, share expiry, export preview, backup freshness and grouped errors.
- [ ] Implement the pure summary/redaction model.
- [ ] Apply public-shell simplification, preview/expiry states, drill-down metrics, recovery actions and safe admin confirmations.
- [ ] Run tests/typecheck/build and responsive checks.
- [ ] Update `CHANGELOG.md` and commit `feat: polish sharing and administration ux`.

### Task 9: Whole-App Verification and Closure

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `TASKS.md`
- Create: `.design/masar-journey/FINAL_REVIEW.md`
- Create: `.design/masar-journey/screenshots/final-*`

**Interfaces:**
- Consumes: all prior task contracts.
- Produces: verified release candidate and closed task ledger.

- [ ] Run `pnpm --filter @archive/next run test`.
- [ ] Run `pnpm --filter @archive/next run typecheck`.
- [ ] Run `pnpm build:next`.
- [ ] Run `node scripts/verify-api-contracts.mjs` and `node scripts/verify-repo-hygiene.mjs`.
- [ ] Run responsive visual smoke for every navigation route at 375/768/1280 and record failures before fixing them.
- [ ] Run accessibility keyboard/focus/contrast smoke and verify reduced motion.
- [ ] Update final review, `CHANGELOG.md`, and `TASKS.md`; confirm no local UX task remains.
- [ ] Commit `docs: close complete ux ui improvement plan`.
