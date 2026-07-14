# Setup wizard flexible input design

## Goal

Make the interactive Setup wizard explain every selectable option and accept common user input forms without guessing ambiguous intent. All new wizard copy is English.

## Input model

- Each multi-choice question displays numbered options, a one-line effect, and entry help: numbers, names, comma/space/plus-separated values, `all`, and `none` where valid.
- Normalize case, surrounding whitespace, comma/plus separators, and repeated selections.
- Accept canonical identifiers and documented aliases only. For runtime profiles: `media`, `ocr`, and `2` select `media`; `edge`, `tls`, `public`, and `3` select `edge`. `core` remains implicit and cannot be removed.
- `all` selects every optional value valid for the current question; `none` selects none. Conflicting values or unknown tokens produce an English explanation and repeat that question.
- The parser returns a canonical ordered list. It never silently enables an option based on partial/fuzzy matching.

## Confirmation flow

- After every choice is normalized and the existing shared resolver accepts the candidate, render a `Your setup summary` with mode, platform, source, access, runtime profiles, capabilities, data services, and storage.
- Ask `Type confirm to continue, back to edit your choices, or q to quit.`
- `confirm` is the sole path that can proceed to provisioning/Docker. `back` restarts choice collection without writing; `q` exits without writing.
- Resolver errors remain authoritative: e.g. public access requires edge. The wizard explains the correction and lets the user edit rather than inferring a change.

## Automation and safety

- `wizard --config`, `plan`, and other non-interactive/JSON paths retain their existing declarative contract and do not prompt for confirmation.
- No values containing credentials are echoed in summaries or parser errors.

## Acceptance criteria

- Tests cover names, aliases, numeric selections, separators, `all`, `none`, unknown/ambiguous input, duplicate removal, and canonical ordering.
- Tests prove `confirm` proceeds once, while `back` and `q` do not write or invoke Docker.
- Tests prove public-without-edge remains a resolver rejection rather than auto-enablement.
