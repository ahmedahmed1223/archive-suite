import assert from "node:assert/strict";
import test from "node:test";

import { collectAgentStatus, countTaskCheckboxes } from "./agent-doctor.mjs";

test("task counter distinguishes open and completed entries", () => {
  assert.deepEqual(countTaskCheckboxes("- [ ] one\n- [x] two\n- [X] three\n"), {
    open: 1,
    completed: 2,
  });
});

test("doctor reports runtime, repository, task, contract, and Docker state", () => {
  const run = (command, args) => {
    const call = [command, ...args].join(" ");
    if (call.includes("pnpm --version")) return { status: 0, stdout: "11.9.0\n", stderr: "" };
    if (call.includes("git") && call.includes("status")) return { status: 0, stdout: " M file.ts\n?? new.ts\n", stderr: "" };
    if (call.includes("docker version")) return { status: 0, stdout: "28.0.0\n", stderr: "" };
    throw new Error(`unexpected command: ${call}`);
  };
  const read = (path) => path.endsWith("TASKS.md") ? "- [ ] open\n- [x] done\n" : "{}";
  const exists = (path) => path.endsWith("archive-contract.openapi.json") || path.endsWith("TASKS.md");

  const status = collectAgentStatus({ root: "D:/repo", run, read, exists });

  assert.equal(status.runtime.node, process.version);
  assert.equal(status.runtime.pnpm, "11.9.0");
  assert.deepEqual(status.repository, { clean: false, changedFiles: 2 });
  assert.deepEqual(status.tasks, { open: 1, completed: 1 });
  assert.equal(status.contract.openapi, true);
  assert.deepEqual(status.docker, { available: true, version: "28.0.0" });
});

test("doctor degrades safely when optional tools are unavailable", () => {
  const unavailable = () => ({ status: 1, stdout: "", stderr: "not found" });
  const status = collectAgentStatus({
    root: "D:/repo",
    run: unavailable,
    read: () => "",
    exists: () => false,
  });

  assert.equal(status.runtime.pnpm, null);
  assert.equal(status.repository.clean, null);
  assert.equal(status.docker.available, false);
  assert.equal(status.contract.openapi, false);
});
