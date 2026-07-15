import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_OPERATIONS, createDockerRuntimeAdapter } from "./runtime-adapter.mjs";

test("Docker runtime adapter declares every lifecycle operation", () => {
  assert.deepEqual(RUNTIME_OPERATIONS, [
    "install", "repair", "start", "stop", "restart", "status", "health", "logs", "exec", "update", "rollback", "uninstall",
  ]);
});

test("Docker runtime adapter records install and repair lifecycle only when a manifest store is supplied", () => {
  const calls = [];
  const adapter = createDockerRuntimeAdapter({
    compose: () => ({ status: 0 }),
    manifestStore: {
      beginInstallationOperation: (request) => calls.push(["begin", request.operation]),
      updateLastSuccessfulStep: (request) => calls.push(["success", request.step]),
      markInstallationFailed: () => calls.push(["failed"]),
    },
    manifestRequest: { path: "manifest.json", input: { version: "1.2.3" } },
  });

  adapter.install();
  adapter.repair();

  assert.deepEqual(calls, [
    ["begin", "install"], ["success", "services-started"],
    ["begin", "repair"], ["success", "services-started"],
  ]);
});

test("Docker runtime adapter resumes after the last successful step without rerunning Compose when no next Docker step remains", () => {
  const calls = [];
  const adapter = createDockerRuntimeAdapter({
    compose: () => { calls.push(["compose"]); return { status: 0 }; },
    manifestStore: {
      beginInstallationOperation: () => ({ decision: { action: "resume", after: "services-started", nextStep: null } }),
      updateLastSuccessfulStep: (request) => calls.push(["success", request.step]),
      markInstallationFailed: () => calls.push(["failed"]),
    },
    manifestRequest: { path: "manifest.json", input: { version: "1.2.3" } },
  });

  assert.deepEqual(adapter.repair(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(calls, [["success", "services-started"]]);
});

test("Docker runtime adapter records a compose exception then rethrows the original error", () => {
  const calls = [];
  const original = new Error("docker unavailable");
  const adapter = createDockerRuntimeAdapter({
    compose: () => { throw original; },
    manifestStore: {
      beginInstallationOperation: () => ({ decision: { action: "install" } }),
      updateLastSuccessfulStep: () => calls.push(["success"]),
      markInstallationFailed: (request) => calls.push(["failed", request.failedStep, request.nextActions]),
    },
    manifestRequest: { path: "manifest.json", input: { version: "1.2.3" } },
  });

  assert.throws(() => adapter.install(), (error) => error === original);
  assert.deepEqual(calls, [["failed", "services-start", ["Docker Compose terminated unexpectedly. Review its output and run repair."]]]);
});

test("Docker runtime adapter returns a programmatic unsupported result without invoking a command", () => {
  const commands = [];
  const adapter = createDockerRuntimeAdapter({
    compose: (args) => {
      commands.push(args);
      return { status: 0 };
    },
  });

  for (const operation of ["update", "rollback", "uninstall"]) {
    assert.deepEqual(adapter[operation](), {
      ok: false,
      supported: false,
      operation,
      reason: "unsupported",
    });
  }
  assert.deepEqual(commands, []);
});

test("Docker runtime adapter delegates update to an injected updateOperation and forwards its result verbatim", async () => {
  const calls = [];
  const adapter = createDockerRuntimeAdapter({
    compose: () => ({ status: 0 }),
    updateOperation: async (request) => { calls.push(request); return { ok: true, code: "UPDATE_COMPLETE", message: "done", details: {}, nextActions: [] }; },
  });

  const result = await adapter.update({ path: "manifest.json" });

  assert.deepEqual(result, { ok: true, code: "UPDATE_COMPLETE", message: "done", details: {}, nextActions: [] });
  assert.deepEqual(calls, [{ path: "manifest.json" }]);
  // rollback/uninstall remain the programmatic unsupported stub — only
  // update has a real implementation for Docker so far.
  assert.deepEqual(adapter.rollback(), { ok: false, supported: false, operation: "rollback", reason: "unsupported" });
});

test("Docker runtime adapter delegates rollback and uninstall to injected operations and forwards their results verbatim", async () => {
  const calls = [];
  const adapter = createDockerRuntimeAdapter({
    compose: () => ({ status: 0 }),
    rollbackOperation: async (request) => { calls.push(["rollback", request]); return { ok: true, code: "ROLLBACK_COMPLETE", message: "done", details: {}, nextActions: [] }; },
    uninstallOperation: async (request) => { calls.push(["uninstall", request]); return { ok: true, code: "UNINSTALL_COMPLETE", message: "done", details: {}, nextActions: [] }; },
  });

  assert.deepEqual(await adapter.rollback({ confirmed: true }), { ok: true, code: "ROLLBACK_COMPLETE", message: "done", details: {}, nextActions: [] });
  assert.deepEqual(await adapter.uninstall({ confirmed: true }), { ok: true, code: "UNINSTALL_COMPLETE", message: "done", details: {}, nextActions: [] });
  assert.deepEqual(calls, [["rollback", { confirmed: true }], ["uninstall", { confirmed: true }]]);
  // update remains the programmatic unsupported stub when not injected.
  assert.deepEqual(adapter.update(), { ok: false, supported: false, operation: "update", reason: "unsupported" });
});

test("Docker runtime adapter maps every supported lifecycle operation to Compose", async () => {
  const commands = [];
  const adapter = createDockerRuntimeAdapter({
    compose: (args, options) => {
      commands.push({ args, options });
      return { status: 0, stdout: "ok", stderr: "" };
    },
    health: async () => ({ status: 0 }),
  });

  assert.deepEqual(adapter.install(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.start(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.stop(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.restart(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.status(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(await adapter.health(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.logs(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.logs({ follow: true }), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.exec(["php", "artisan", "about"]), { ok: true, supported: true, status: 0, stdout: "ok", stderr: "" });
  assert.deepEqual(commands, [
    { args: ["up", "-d"], options: undefined },
    { args: ["up", "-d"], options: undefined },
    { args: ["down"], options: undefined },
    { args: ["restart"], options: undefined },
    { args: ["ps"], options: undefined },
    { args: ["logs", "--tail=200"], options: undefined },
    { args: ["logs", "--tail=200", "-f"], options: undefined },
    { args: ["exec", "-T", "laravel-fpm", "php", "artisan", "about"], options: undefined },
  ]);
});

test("Docker runtime adapter permits a local build only for an explicit development adapter", () => {
  const commands = [];
  const adapter = createDockerRuntimeAdapter({ compose: (args) => { commands.push(args); return { status: 0 }; }, buildLocal: true });
  assert.deepEqual(adapter.install(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(commands, [["up", "-d", "--build"]]);
});

test("Docker runtime adapter propagates Compose and health failures as structured results", async () => {
  const adapter = createDockerRuntimeAdapter({
    compose: () => ({ status: 23, stdout: "compose output", stderr: "compose failure" }),
    health: async () => ({ status: 503 }),
  });

  assert.deepEqual(adapter.restart(), { ok: false, supported: true, status: 23 });
  assert.deepEqual(await adapter.health(), { ok: false, supported: true, status: 503 });
  assert.deepEqual(adapter.exec(["php", "artisan", "about"]), {
    ok: false,
    supported: true,
    status: 23,
    stdout: "compose output",
    stderr: "compose failure",
  });
});
