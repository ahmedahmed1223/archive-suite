# Canonical Laravel Agent Guidance

This file extends the repository-root `AGENTS.md` for work under `archive-laravel/`.

## Scope and contracts

- This is the canonical Laravel API and operational backend.
- `docs/api/archive-contract.openapi.json` is the public API source of truth.
- Public API changes must update OpenAPI, Laravel behavior, Next.js bindings, and contract checks in the same approved task.
- Run PHP and Composer workflows through the repository Docker helpers unless the task explicitly targets a native runtime.

## Implementation rules

- Keep authorization server-side and cover role/ownership boundaries with tests.
- Preserve short-lived access-token and rotating HttpOnly refresh-cookie semantics.
- Use migrations for persistent schema changes and provide a safe rollback where Laravel supports it.
- Queue or media work must be idempotent, observable, retry-bounded, and explicit about terminal failure.
- Never place credentials, tokens, user paths, or real archive data in fixtures, logs, snapshots, or evidence.

## Minimum verification

- Controller, policy, service, job, or model change: focused PHPUnit test through the Docker helper.
- Public API change: API contract and generated-client checks in addition to focused Laravel and Next.js tests.
- Migration, queue, backup, or operational change: include failure-path and recovery verification.
- Before completion of a backend slice, run `pnpm verify:laravel` when the environment supports Docker.

Use `docs/agents/verification-matrix.md` to select the complete gate for the change.
