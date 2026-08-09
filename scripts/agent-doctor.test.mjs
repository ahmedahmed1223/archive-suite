import assert from "node:assert/strict";
import test from "node:test";

import { collectAgentStatus } from "./agent-doctor.mjs";

test("doctor reports runtime, repository, contract, and Docker state", () => {
  const run = (command, args) => {
    const call = [command, ...args].join(" ");
    if (call.includes("pnpm --version")) return { status: 0, stdout: "11.9.0\n", stderr: "" };
    if (call.includes("git") && call.includes("status")) return { status: 0, stdout: " M file.ts\n?? new.ts\n", stderr: "" };
    if (call.includes("docker --version")) return { status: 0, stdout: "Docker version 28.0.0, build abc\n", stderr: "" };
    if (call.includes("docker info")) return { status: 0, stdout: "28.0.0\n", stderr: "" };
    throw new Error(`unexpected command: ${call}`);
  };
  const exists = (path) => path.endsWith("archive-contract.openapi.json");

  const status = collectAgentStatus({ root: "D:/repo", run, exists });

  assert.equal(status.runtime.node, process.version);
  assert.equal(status.runtime.pnpm, "11.9.0");
  assert.deepEqual(status.repository, { clean: false, changedFiles: 2 });
  assert.equal(status.contract.openapi, true);
  assert.deepEqual(status.docker, {
    installed: true,
    cliVersion: "Docker version 28.0.0, build abc",
    daemonAvailable: true,
    serverVersion: "28.0.0",
    deploymentOutput: "primary",
  });
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
  assert.equal(status.docker.installed, false);
  assert.equal(status.docker.daemonAvailable, false);
  assert.equal(status.docker.deploymentOutput, "primary");
  assert.equal(status.contract.openapi, false);
});
