# Legacy Parity Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish migration parity from the legacy Archive Suite React app into the canonical Masar Laravel + Next stack.

**Architecture:** Legacy `archive-app` and `archive-server` are reference-only. New UI belongs in `archive-next`; durable behavior and integrations belong in `archive-laravel`; shared contracts belong in `archive-core` only when a public client/server shape is needed.

**Tech Stack:** Next.js App Router, React 19, Laravel API, OpenAPI contract checks, existing Masar CSS tokens and local UI primitives.

---

## Coordination Rules

- [x] **Task 0: Fix login/session flow**
  - Implemented in commit `fix(next): restore login session flow`.
  - Verifications run: `pnpm --filter @archive/next run typecheck`, `pnpm run build:next`, `git diff --check`.

- [ ] **Task 1: Maintain the parity ledger**
  - Source of truth: `docs/design/masar-legacy-parity-audit.md`.
  - Keep every legacy `archive-app/src/features/*` directory and every `archive-app/src/pages/*Page.tsx` listed.
  - Run `pnpm run verify:repo-hygiene` after edits.

- [x] **Task 2: Discovery and relations**
  - Add Laravel discover and relation graph endpoints.
  - Add `/discover`, `/graph`, and record-detail relation panel in Next.
  - Update navigation once the routes are usable.

- [ ] **Task 3: History, notes, and sync**
  - Add audit-backed record history and diffs.
  - Add record notes/comments outside media review. Private notes are implemented; team comments remain audit-backed follow-up.
  - Add `/sync` for sync log/conflict states.

- [ ] **Task 4: Intake and saved workflows**
  - Restore AddVideo-style metadata wizard in canonical intake.
  - Add templates, import-from-url preview, upload links, and saved-search manager.
  - Persist local-only entities in Laravel where they affect product state.

- [ ] **Task 5: Operations and system control**
  - Add `/data-center`, `/system/control`, live `/status` metrics, DR probes, user data export, and backup extras.
  - Keep dangerous host actions disabled by default behind explicit env flags.

- [ ] **Task 6: Media, montage, and broadcast**
  - Wire play/compare to media source picker.
  - Restore advanced montage and MP4 export as async Laravel media jobs.
  - Add broadcast/MOS/MXF metadata surfaces with config-required state when integrations are absent.

## Acceptance Gates

- `pnpm run typecheck`
- `pnpm run build:next`
- `pnpm run verify:api-contracts`
- `pnpm run verify:repo-hygiene`
- `git diff --check`
- Smoke critical routes after each UI slice.
