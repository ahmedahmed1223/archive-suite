# Wave 1 Final Review Fix Report

## Scope

- Corrected the `/types` OpenAPI and handwritten/generated TypeScript contract to preserve Laravel's nullable `fieldAcl`, `fieldAcl.view`, and `fieldAcl.edit` behavior.
- Documented the existing 255-character Laravel validation boundary for `fields.*.condition.field` in OpenAPI and added focused regression coverage.
- Strengthened the requested UI and controller tests; updated stale non-contracted entity icon comments.

## TDD evidence

- RED: the focused Next run initially failed in `TypesList.test.tsx` because this environment exposes no `window.localStorage`; the failure was in test cleanup (`Cannot read properties of undefined (reading 'clear')`), before the strengthened SVG assertion could run.
- Test setup correction: made the pre-existing cleanup tolerant of unavailable local storage (`window.localStorage?.clear?.()`). This is test-only and permits the actual component behavior to be exercised.
- GREEN: `pnpm --filter @archive/next exec vitest run app/types/_components/TypesList.test.tsx lib/contextual-tips.test.ts` passed: 2 files, 6 tests.
- Laravel controller regressions were added test-first. The first Docker attempt was blocked by sandbox access to `C:\Users\LAPTOP PC WORLD\.docker`; the approved Docker-backed rerun passed: 19 tests, 71 assertions. This verifies null ACL persistence/round-trip, null view/edit persistence/round-trip, 256-character condition-field rejection, icon update persistence, and paginated icon presence.

## Verification evidence

- `pnpm api:generate` — passed; generated binding updated.
- `pnpm verify:api-contracts` — passed.
- `pnpm verify:api-generated` — passed.
- `pnpm typecheck` — passed.
- Focused Next test command — passed: 2 files, 6 tests.
- `pnpm test:next` — passed: 86 files, 467 tests. The suite emitted pre-existing jsdom navigation notices only.
- `node scripts/laravel-docker.mjs test tests/Feature/TypesControllerTest.php` — passed: 19 tests, 71 assertions.
- `git diff --check` — passed with no whitespace errors.

## Accepted decisions and follow-up

- Accepted pre-release cutover decision: do not migrate browser-stored type icons from the old client-side store. Type icons now persist through the API; pre-release local values are intentionally not migrated.
- Follow-up: optional `StorageRowPayload` metadata remains outside this fix. OpenAPI allows additional properties by default, and the handwritten client already consumes timestamps. Response metadata schemas are intentionally not expanded here.
