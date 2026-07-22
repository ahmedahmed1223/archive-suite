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
