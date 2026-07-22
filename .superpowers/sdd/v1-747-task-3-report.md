# V1-747 Task 3 — Archive macro recorder UI

## Delivered

Added a focused Arabic bulk-macro recorder to the canonical archive selection toolbar. Editors can build ordered add-tag, workflow-status, and recoverable-delete steps; reorder/remove them; save or select owned macros; request the typed server preview; and execute only with the signed preview token. Preview details include affected/missing counts, expiry, and per-target results. Selection, macro, and step changes invalidate an existing preview. The page only derives explicit, unique `{store,id}` targets and does not contain a destructive endpoint fallback.

## Verification

```text
pnpm --filter @archive/next exec vitest run app/archive/_components/bulk-macro-helpers.test.ts app/archive/_components/BulkMacroRecorder.test.tsx
PASS (2 files, 2 tests)

pnpm typecheck
PASS
```

The focused authenticated Playwright command was added and attempted against the running supported Next server:

```text
pnpm --filter @archive/next exec playwright test e2e/bulk-macro-recorder.authed.spec.ts --project=authenticated
```

It is blocked before the recorder test by the shared `auth.setup.ts` provisioning fixture: `login(admin): non-JSON response (500) — Internal Server Error`.

## Follow-up verification

The recorder now selects the archive card through its accessible `تحديد …` checkbox in the live workflow, rather than clicking the list item. The focused authenticated test records/reorders/removes steps, verifies preview-before-run, exercises preview outcomes and reversibility, invalidates the preview by changing the selection, and renders the persisted run result. The UI also localizes workflow/result codes, exposes saved-macro deletion and typed run history, and renders the typed per-step outcomes and delete recovery explanation.

```text
pnpm --filter @archive/next exec vitest run app/archive/_components/bulk-macro-helpers.test.ts app/archive/_components/BulkMacroRecorder.test.tsx
PASS (2 files, 2 tests)

pnpm typecheck
PASS

$env:ARCHIVE_E2E_SPECS='e2e/bulk-macro-recorder.authed.spec.ts'; pnpm verify:laravel-next:live
EXIT 1 after 89s; the manager-owned Docker/live harness returned no diagnostic output.
```
