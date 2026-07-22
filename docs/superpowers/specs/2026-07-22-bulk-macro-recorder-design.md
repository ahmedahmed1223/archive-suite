# V1-747 Bulk Macro Recorder Design

## Outcome

Editors and administrators can record an ordered sequence of bulk actions, save it under a reusable Arabic name, preview its exact effect on a selected set of archive records, and execute it only with the signed preview confirmation returned by the server. Viewers may not manage or run macros.

## Macro Model

Macros are owned by a user and persisted in Laravel. A macro has a name, optimistic `version`, and one to ten ordered steps. Supported steps are:

- `add-tag` with a non-empty tag;
- `set-workflow-status` with one of `draft`, `editing`, `review`, `approved`, `published`, `archived`;
- `delete`, which uses the existing recoverable trash semantics.

Targets are explicit `{store, id}` pairs, de-duplicated and limited to 1,000 per preview/run. The run processes steps in recorded order and returns a result for every target and step. A failure is recorded without hiding earlier completed work; no atomic rollback is claimed.

## Mandatory Preview

`POST /bulk-macros/{id}/preview` reads the current records, calculates before/after summaries and per-step outcomes without changing records or trash, and returns a signed confirmation token expiring after 15 minutes. The signature binds user, macro ID/version, ordered targets, and expiry using the application key.

`POST /bulk-macros/{id}/run` requires the same targets and valid confirmation token. It rejects expired, altered, cross-user, or stale-macro tokens. Actual writes reuse the record/trash domain rules and produce a persisted run record with counts and per-step results.

## UI

The archive selection toolbar gains an explicit recorder. While recording, the user adds supported steps, reorders/removes them, names the macro, and saves it. Saved macros can be selected for the current record selection. The UI must show the preview first, including affected/missing records, step order, reversibility, and token expiry; only then is the run button enabled. Results are announced accessibly in Arabic.

## Contract and Verification

OpenAPI is the source of truth for CRUD, preview, and run envelopes. Laravel tests cover ownership, roles, validation, step ordering, non-mutating preview, token binding/expiry, partial results, trash semantics, and run history. Next unit and Playwright tests cover recording, reordering, preview gating, execution, and no run request before preview. Final gates are contract/generated verification, typecheck, full Next tests/build, focused Laravel suites, focused Playwright, and one comprehensive review.

