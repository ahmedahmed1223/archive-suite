# Setup Menu Result Pause Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep each interactive main-menu operation result visible until the user acknowledges it, without rerunning the operation or affecting automation.

**Architecture:** Put acknowledgement behavior in the existing CLI module and call it once from the interactive menu loop after the selected handler settles. Named CLI, non-TTY, and `--json` paths never invoke that helper.

**Tech Stack:** Node.js ESM, Node built-in test runner, readline prompt abstraction.

## Global Constraints

- All new user-facing copy is English.
- Preserve `--json`, named command, and non-TTY output contracts.
- Enter returns to the menu; lowercase or uppercase `q` exits; other input re-prompts only.
- Do not rerun a selected operation while acknowledging it.
- Do not touch `archive-next/next-env.d.ts`.

---

### Task 1: Add acknowledgement behavior to the interactive menu

**Files:**
- Modify: `scripts/control-center/cli.mjs`
- Modify: `scripts/control-center.mjs`
- Test: `scripts/control-center.test.mjs`
- Modify: `ChangeLog.md`

**Interfaces:**
- Produces: `acknowledgeMenuResult({ prompt, log }): Promise<'menu' | 'quit'>`.
- Consumes: the main menu's existing `prompt()` and `log()` functions.

- [ ] **Step 1: Write failing focused tests**

```js
test('interactive menu acknowledges a completed operation once before returning', async () => {
  const prompts = ['1', '', 'q'];
  let executions = 0;
  await runInteractiveMenu({
    prompt: async () => prompts.shift(),
    menuItems: [['1', 'Status', async () => { executions += 1; }]],
  });
  assert.equal(executions, 1);
});

test('interactive acknowledgement q exits without rerunning the command', async () => {
  const prompts = ['1', 'q'];
  let executions = 0;
  const result = await runInteractiveMenu({ /* controlled prompt and one item */ });
  assert.equal(result, 'quit');
  assert.equal(executions, 1);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test scripts/control-center.test.mjs`

Expected: FAIL because the menu currently returns immediately after calling an item.

- [ ] **Step 3: Implement the helper and single loop invocation**

```js
export async function acknowledgeMenuResult({ prompt, log }) {
  for (;;) {
    const answer = (await prompt('Press Enter to return to the main menu, or q to quit: ')).trim().toLowerCase();
    if (answer === '') return 'menu';
    if (answer === 'q') return 'quit';
    log('Please press Enter to return, or q to quit.');
  }
}
```

Call it exactly once after `await item[2]()` in the interactive loop. Return from the loop on `'quit'`; do not call the handler again. Skip this loop entirely for named command, `--json`, and non-TTY entry paths.

- [ ] **Step 4: Add and pass coverage for invalid acknowledgement and automation safety**

```js
test('invalid acknowledgement repeats only the acknowledgement prompt', async () => { /* x, Enter; assert one operation */ });
test('named JSON command never renders the acknowledgement prompt', async () => { /* invoke --json; assert prompt count zero */ });
```

Run: `node --test scripts/control-center.test.mjs`

Expected: PASS including the new acknowledgement cases.

- [ ] **Step 5: Document and commit**

Add a concise English `ChangeLog.md` entry describing the interactive-only result pause and automation-safe exclusions.

Run: `git diff --check`

Commit only task files: `git commit -m "feat(setup): pause after interactive menu results"`.
