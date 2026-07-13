# V1-003 implementation report

Status: DONE

## Baseline

- Node.js: 22.12.0, constrained to `>=22.12.0 <23`
- pnpm: 11.9.0, integrity-pinned by root `packageManager`
- PHP: 8.4.23, provided by `php:8.4.23-fpm`
- Composer: 2.9.5, copied from `composer:2.9.5`
- Canonical machine-readable source: `infra/platform/toolchain.v1.json`

## TDD evidence

- RED: `node --test scripts/verify-reproducibility.test.mjs` failed 2/2 because the toolchain contract was absent and root bootstrap was not frozen.
- GREEN: the same command passed 2/2 after the contract, consumers, docs, and verification wiring were added.

## Clean install evidence

Created a new archive of tracked `2f8008a`, overlaid only V1-003 changes, and ran the canonical command in `.superpowers/sdd/v1-003-clean-install`. This did not delete or mutate the working checkout's dependency directories.

`pnpm install --frozen-lockfile` completed with exit 0: 262 packages installed in 5.3s using pnpm 11.9.0. The host's Node 24.15.0 produced the expected unsupported-engine warning because the supported line is Node 22.

## Verification evidence

Fresh escalated `pnpm verify` completed with exit 0:

- reproducibility: 2/2
- Next/Vitest: 19 files, 122/122 tests
- Next production build: 51 routes
- repository hygiene: passed
- Laravel: 526 passed, 2468 assertions, 2 environment-dependent skips, 1 pre-existing `mkdir(): File exists` warning

## Commit

Parent: `2f8008a`. Focused commit subject: `build: make V1-003 installs reproducible`. The resulting commit hash is reported in the task handoff.
