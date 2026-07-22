# Cost-Effective Agent Delivery Design

## Objective

Reduce the open Archive Suite release backlog through manager-controlled, locally verifiable delivery slices. Cost-effective implementation agents perform bounded work; the primary agent owns scope, reviews, integration, shared contracts, task-ledger updates, and merges to `master`.

## Current State

- `TASKS.md` declares 63 open items but contains 47 unchecked task entries.
- The canonical product path is `archive-next/` plus `archive-laravel/`.
- Work is performed on `master` because the user explicitly requested manager-led merges to `master`.
- External acceptance, credentials, clean-host evidence, hardware-specific validation, publishing, and organizational sign-offs cannot be delegated as locally complete work.

## Delivery Model

Work proceeds as sequential, bounded slices. Each slice receives a fresh cost-effective implementation agent with a narrow file boundary, explicit acceptance criteria, and targeted verification commands. Sequential dispatch is preferred because the agents share a workspace and many remaining tasks converge on common Next.js components, API bindings, and tests.

The primary agent:

1. Selects the next locally verifiable slice in dependency order.
2. Defines owned files and prevents concurrent edits to shared files.
3. Retains ownership of `TASKS.md`, `ChangeLog.md`, the OpenAPI contract, and cross-slice integration.
4. Reviews every implementation diff for requirements and code quality.
5. Runs fresh targeted and integration verification.
6. Commits or accepts only verified work into `master`.
7. Updates the task ledger only when the recorded acceptance criteria are actually complete.

## Agent Economics

Implementation work uses the lower-cost `gpt-5.6-terra` model with low reasoning for routine, well-bounded slices and medium reasoning when a slice includes domain or contract complexity. Reviews may use medium reasoning when risk warrants it. A slice is narrowed or returned for correction rather than escalating immediately to an expensive broad implementation run.

## Initial Delivery Order

The first wave focuses on locally testable development work:

1. Correct the task-ledger count from 63 to the mechanically verified open count.
2. Complete a bounded V1-794 slice, avoiding unlicensed font downloads and retaining backend-contract work under manager control.
3. Complete a bounded V1-306C slice for remaining role-gated UI behavior or contextual role help.
4. Complete a bounded V1-791 Arabic-language audit slice with deterministic checks and documented terminology.

After integration remains stable, subsequent waves can take V1-736 and V1-747 slices. Architecture tasks V1-786 and V1-790 require dedicated designs and plans because they affect domain boundaries and shared contracts.

## TDD and Verification

Every behavior change begins with a failing test that fails for the expected reason. The implementation agent then adds the minimum production change, reruns the focused test, and performs limited refactoring while green.

The primary agent independently checks each diff and reruns the relevant commands. Typical gates include:

- `pnpm typecheck`
- `pnpm test:next`
- `pnpm build:next`
- `pnpm verify:api-contracts` when public contracts change
- targeted Laravel tests through the repository Docker helpers for backend changes

The full verification scope is proportional to the slice, but no completion or task-ledger closure is claimed without fresh evidence.

## Integration and Failure Handling

- Agents do not edit `TASKS.md` or `ChangeLog.md`.
- Shared contract files have one owner at a time.
- An agent must report files changed, tests run, and any unresolved limitations.
- The primary agent rejects changes that exceed scope, lack TDD evidence, or leave important review findings open.
- If a slice exposes a material scope expansion, delivery pauses for an updated design and user approval.
- External or environment-blocked acceptance remains open with the blocking capability documented.

## Success Criteria

- The task-ledger count matches its unchecked entries.
- Each accepted slice is independently reviewed, freshly verified, and represented by an intentional commit on `master`.
- No legacy package receives net-new features.
- No external acceptance or release sign-off is falsely closed through local simulation.
- The open-task count decreases only when the complete acceptance criteria for a task are satisfied.
