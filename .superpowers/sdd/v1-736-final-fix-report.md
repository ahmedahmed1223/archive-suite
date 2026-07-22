# V1-736 final fix report

Commit hash: `HEAD` (the scoped V1-736 final-fix commit; recorded in the task handoff).

## RED

- Focused Next tests failed before implementation because the page still treated scenario descriptors as string IDs and the safety panel still exposed an audit/execution follow-up.
- `SafetyPreviewApiTest` failed before implementation: successful responses lacked `ok: true`, and unauthenticated/forbidden preview responses lacked `synthetic: true`.

## GREEN

- Laravel feature test: `SafetyPreviewApiTest` — 9 passed, 70 assertions. Covers success, 401, 403, 422, synthetic-only fixtures, and no audit/database writes.
- OpenAPI bindings regenerated; API contract and generated-binding checks pass.
- Next typecheck, focused Vitest (11 tests), and production build pass.
- Focused Chromium Playwright safety-preview spec passes (1 test). It verifies the Arabic restore simulation and confirms no live destructive endpoint is requested.

## Scope

- Added a route-scoped response marker middleware ahead of preview auth. Validation is caught only by the preview controller so global error contracts remain unchanged.
- Success responses now use the `ok: true` envelope, while all preview error responses carry `synthetic: true`.
- Laravel supplies Arabic scenario descriptions; the UI renders them, uses real fixture defaults, localizes result reasons, and labels this page as a simulation without audit/execution messaging.

## Follow-up: preview error typing

- RED: the focused type assertion failed because `ApiEnvelope` omitted `synthetic` from its generic error branch.
- GREEN: `SafetyPreviewEnvelope` and `SafetyPreviewError` now require `synthetic: true` only for the two preview methods. Generic API errors remain unchanged.
- Verified with focused API-client Vitest (3 tests), API contract/generated-binding checks, and Next typecheck.
