# Setup menu result pause design

## Goal

Keep interactive Setup users on an operation's result until they explicitly acknowledge it, instead of immediately returning them to the main menu. All new user-facing wording is English.

## Scope

- Apply only to the interactive main-menu loop.
- After each selected operation completes, render a concise result/next-step message and prompt: `Press Enter to return to the main menu, or q to quit.`
- Enter returns to the menu; `q` exits cleanly. Invalid acknowledgement input repeats the prompt without rerunning the operation.
- Preserve the existing wizard's question flow: do not pause after individual wizard questions; pause after the wizard operation returns to the menu.
- Do not pause or add display noise for named CLI commands, non-TTY execution, or `--json` output. These paths remain automation-safe.

## Design options considered

1. Pause after every wizard question: rejected because it adds friction to a guided flow.
2. Pause only after long-running operations: rejected because users cannot predict whether results will remain visible.
3. Pause after every interactive menu operation: selected because it is predictable and preserves success, warning, and failure details for the user.

## Implementation boundary

Add a small acknowledgement helper to the existing CLI display/prompt module, invoke it once from the interactive menu loop after command completion (including errors handled by that loop), and cover Enter, q, invalid acknowledgement, error result, non-interactive behavior, and JSON behavior with focused tests.

## Acceptance criteria

- A menu operation's output remains visible until Enter or q.
- The helper never runs selected operation twice.
- `q` terminates the interactive loop.
- Named commands and JSON/non-TTY invocations do not prompt or alter their output contract.
