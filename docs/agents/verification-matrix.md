# Agent Verification Matrix

Use the smallest focused test while developing, then run every applicable gate before declaring the approved task complete. A missing external capability is reported as blocked; it is not a passing result.

| Change type | Focused development check | Completion gate |
| --- | --- | --- |
| Next.js logic or component | Focused Vitest file | `pnpm test:next` and `pnpm typecheck` |
| Route, layout, or interactive UI | Focused Playwright spec | `pnpm typecheck`, `pnpm test:next`, and `pnpm build:next` |
| Live authenticated journey | Focused live Playwright spec | `pnpm verify:laravel-next:live` |
| Laravel controller, policy, service, model, or job | Focused PHPUnit class through Docker | `pnpm verify:laravel` |
| Public API request or response | Focused Laravel and client tests | `pnpm verify:api-contracts`, `pnpm verify:api-generated`, Next typecheck, and Laravel tests |
| Database migration or persistence | Migration and rollback/failure test | Laravel suite plus a live integration path that reads and writes the changed data |
| Root Node script | Focused `node --test` file | Related script suites and `pnpm verify:repo-hygiene` |
| Docker or deployment configuration | `docker compose ... config` for the affected file | Isolation, health, failure, and cleanup proof |
| Authentication, authorization, secrets, or evidence | Focused negative-path tests | `pnpm security:baseline` plus applicable live role tests |
| Dependency or runtime pin | Reproducibility test | `pnpm verify:reproducibility` and affected build |
| Release workflow | Focused release-contract tests | `pnpm release:verify` on the intended release runner |

## Task handoff

Every completed task report should identify:

- the approved scope and any deviations;
- files and public contracts changed;
- commits created;
- exact checks run and their results;
- checks not run and why;
- remaining risks, external evidence, or follow-up task IDs;
- unrelated working-tree changes deliberately preserved.
