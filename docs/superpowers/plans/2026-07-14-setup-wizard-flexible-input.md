# Setup Wizard Flexible Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the interactive Setup wizard explain options, normalize documented user input forms, and require confirmation before provisioning.

**Architecture:** Create a focused choice-parser module consumed by `setup-wizard.mjs`; it returns canonical arrays or a safe validation error. Keep confirmation orchestration in the wizard/control-center boundary and preserve the shared resolver as the authority for legal configurations.

**Tech Stack:** Node.js ESM and Node built-in test runner.

## Global Constraints

- All new wizard copy is English.
- Accept only documented aliases; never fuzzy-match or silently enable a feature.
- `core` is always enabled; `public` still requires `edge` through the existing resolver.
- `confirm` is the only path from summary to write/Docker; `back` and `q` do neither.
- `wizard --config`, named CLI, non-TTY, and `--json` retain their declarative behavior.
- Do not touch `archive-next/next-env.d.ts` or concurrent P2 work.

---

### Task 1: Parse flexible wizard choices and confirm the summary

**Files:**
- Create: `scripts/control-center/wizard-choice-parser.mjs`
- Test: `scripts/control-center/wizard-choice-parser.test.mjs`
- Modify: `scripts/control-center/setup-wizard.mjs`
- Modify: `scripts/control-center.mjs`
- Test: `scripts/control-center.test.mjs`
- Modify: `ChangeLog.md`

**Interfaces:**
- Produces `parseWizardChoices(input, { options, aliases, allowAll, allowNone })` returning a unique canonical array or `{ code, message }` error.
- Produces `collectWizardRuntimeChoices(...)` choices only after valid normalization.

- [ ] Write failing parser tests for `media + edge`, `2, 3`, aliases (`ocr`, `tls`), `all`, `none`, duplicates, and unknown token rejection.
- [ ] Implement separator/case normalization and exact alias lookup; preserve declared option order.
- [ ] Write failing controlled-prompt tests proving English option help, `back` and `q` do not provision, and `confirm` provisions exactly once.
- [ ] Implement summary/confirmation around the existing resolver; never auto-add edge for public and never echo credential values.
- [ ] Run parser and Control Center tests, `node --check`, and `git diff --check`; update ChangeLog and commit task files only.
