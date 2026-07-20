import assert from "node:assert/strict";
import test from "node:test";

import { createDockerProvider } from "./docker.mjs";

function runFake(calls, result = { status: 0, stdout: "", stderr: "" }) {
  return async (cmd, args) => {
    calls.push([cmd, args]);
    return typeof result === "function" ? result(cmd, args) : result;
  };
}

test("docker provider scopes every command and destroys only its project", async () => {
  const calls = [];
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-001",
    run: runFake(calls),
    getFreePort: async () => 43123,
  });
  await provider.prepare();
  await provider.destroy();
  assert.ok(calls.every(([cmd]) => cmd === "docker"));
  assert.ok(calls.flatMap(([, args]) => args).includes("archive-acceptance-run-001"));
  assert.ok(calls.some(([, args]) => args.includes("down") && args.includes("--remove-orphans")));
});

test("destroy fails when leftover containers remain for the project", async () => {
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-002",
    run: async (cmd, args) => {
      if (args.includes("ps")) return { status: 0, stdout: "abc123\n", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    },
    getFreePort: async () => 43124,
  });
  await assert.rejects(() => provider.destroy(), /leftover/i);
});

test("rejects a project name that does not match the ownership pattern", () => {
  assert.throws(
    () => createDockerProvider({ root: "D:/repo", runId: "not valid!", run: async () => {}, getFreePort: async () => 1 }),
    /project name/i,
  );
});
