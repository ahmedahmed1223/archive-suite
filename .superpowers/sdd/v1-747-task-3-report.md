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

## E2E preview-heading follow-up

The recorder-scoped preview assertion now uses exact text for the `معاينة موقعة` heading, avoiding the helper sentence that also contains that phrase.

```text
pnpm typecheck
PASS
```

## Checkbox toggle follow-up

Card and table checkbox adapters now turn a plain click on an already-selected record into the existing additive-toggle selection mode, while retaining shift/ctrl/meta behavior unchanged. The stateful card test verifies both native check and uncheck activation.

```text
pnpm --filter @archive/next exec vitest run app/archive/selection.test.ts app/archive/ArchiveRecordCard.test.tsx app/archive/_components/bulk-macro-helpers.test.ts app/archive/_components/BulkMacroRecorder.test.tsx
PASS (4 files, 24 tests)

pnpm typecheck
PASS
```

## E2E stable-target follow-up

The live workflow now retains the editor fixture record through `تحديد سجل editor المعزول` for its check, deselect, and reselect actions, instead of relying on a list-order-sensitive `.first()` locator.

```text
pnpm typecheck
PASS
```

## E2E history mock follow-up

The live route stub now returns the typed `{ ok: true, runs: [] }` run-history envelope before its generic macro-list GET branch, matching the recorder's post-save history request.

```text
pnpm typecheck
PASS
```

## E2E locator follow-up

The live recorder spec scopes all recorder inputs, controls, outcome assertions, and post-reselection checks to the named `region` (`مسجل الإجراءات الجماعية`). This avoids strict locator collisions with the pre-existing bulk action toolbar's add-tag control.

```text
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

## Checkbox follow-up

The live trace identified native checkbox cancellation in both archive-card and table selection handlers. Those handlers now forward modifier-aware selection without cancelling browser activation, so Playwright's accessible `.check()` interaction updates the controlled selection normally.

```text
pnpm --filter @archive/next exec vitest run app/archive/ArchiveRecordCard.test.tsx app/archive/_components/bulk-macro-helpers.test.ts app/archive/_components/BulkMacroRecorder.test.tsx
PASS (3 files, 12 tests)

pnpm typecheck
PASS
```
