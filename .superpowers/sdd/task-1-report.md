# Task 1 — Flexible wizard choices and explicit confirmation

## Delivered

- Added a strict, reusable `parseWizardChoices` parser for exact option names,
  declared aliases, option numbers, and comma/`+`/`;`/`|` separators.
- Added English wizard help that explains optional profiles/capabilities,
  `all`/`none`, aliases, and the resource/exposure implications of `media`
  and `edge`.
- Kept `core` mandatory and never inferred `edge`; shared configuration policy
  still rejects public access without an explicit edge selection.
- Replaced the confirmation default with literal `confirm`; `back` restarts
  choices without writes and `q` cancels. Empty input cannot install.
- Review follow-up: profile numbering now reserves `1` for implicit `core`, so
  `2`/`media`/`ocr` select `media` and `3`/`edge`/`tls`/`public` select
  `edge`. Unknown raw input is redacted before terminal output, invalid plans
  return to the questions before writes, and the summary heading is `Your
  setup summary`.

## TDD and verification

- RED: parser test first failed because the parser module did not exist.
- RED: confirmation integration test first failed because the Control Center
  did not use the explicit confirmation gate.
- RED: empty confirmation test caught an unsafe implicit `confirm` default;
  the default was removed before the final run.
- RED (review follow-up): numeric profile selection, credential-URL redaction,
  and the renamed heading each failed before the implementation was aligned.
- Final: `node --test scripts/control-center.test.mjs scripts/control-center/*.test.mjs scripts/platform-contract.test.mjs` — 130 passed, 0 failed.
- Final: `node --check` passed for `control-center.mjs`, `setup-wizard.mjs`, and `wizard-choice-parser.mjs`; `git diff --check` passed.

## Scope and isolation

- Only task hunks in `scripts/control-center.mjs` and
  `scripts/control-center.test.mjs` will be staged; concurrent P2 update work
  in those files is deliberately excluded.
- `archive-next/next-env.d.ts` and all other user/concurrent edits were not
  touched or staged.
