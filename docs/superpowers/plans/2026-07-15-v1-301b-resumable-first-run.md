# V1-301B Resumable First-run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/first-run` show and update the organisation-wide onboarding progress after login, so it resumes truthfully across browsers and sessions.

**Architecture:** A pure helper maps the five API stages to Arabic actionable UI steps and derives completion only from the server response. The page loads progress only for an authenticated session, renders loading/error/retry states, and sends an admin toggle through `updateOnboardingStage`; setup preset and expert skip remain local preferences because they are not organisation milestones.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not reintroduce `ONBOARDING_STORAGE_KEY` as a source of progress truth.
- Do not mark a stage complete before the PATCH response succeeds.
- Guests may open `/first-run` but must see an actionable login state rather than an API error.
- Editors and viewers see progress but no editable completion controls.
- Keep V1-301C live fixture work out of this task.

---

### Task 1: Progress-view model and RED tests

**Files:**
- Create: `archive-next/lib/onboarding-progress.ts`
- Create: `archive-next/lib/onboarding-progress.test.ts`

**Interfaces:** `toOnboardingProgressSteps(progress)` returns the five ordered Arabic UI steps with `id`, `title`, `description`, `href`, `actionLabel`, and `completed`.

- [x] Write tests proving API order is normalized to the fixed milestone order, only server `completed` statuses mark a step complete, and every step supplies an executable Arabic action.
- [x] Run `pnpm --filter @archive/next test -- onboarding-progress.test.ts`; confirmed RED because the helper was absent.
- [x] Implement the fixed mapping and run the same test to GREEN.

### Task 2: Resumable first-run UI

**Files:**
- Modify: `archive-next/app/first-run/page.tsx`
- Modify: `archive-next/lib/setup-journey.test.ts`

- [x] Add a source-level RED test asserting the page reads `api.onboardingProgress`, gates mutations with `auth.user?.role === "admin"`, and does not persist `ONBOARDING_STORAGE_KEY`.
- [x] Replace local `done` state, local step toggling, and local “mark complete” with authenticated API loading, Arabic loading/error/retry feedback, and server-confirmed admin updates.
- [x] Keep the existing local preset and expert skip preferences; feed `settingsReviewed` from server completion rather than the old local map.
- [x] Run focused Vitest tests; GREEN at 8/8.

### Task 3: Verification, records, and commit

**Files:**
- Modify: `TASKS.md`
- Modify: `ChangeLog.md`

- [x] Run focused Vitest, `pnpm typecheck`, and `pnpm build:next`.
- [x] Mark V1-301B complete with factual verification evidence, leaving V1-301C open.
- [ ] Review `git diff --check`, stage only V1-301B files, and commit `feat(onboarding): resume first-run progress`.
