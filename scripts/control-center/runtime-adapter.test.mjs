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
    { args: ["up", "-d", "--build"], options: undefined },
    { args: ["up", "-d"], options: undefined },
    { args: ["down"], options: undefined },
    { args: ["restart"], options: undefined },
    { args: ["ps"], options: undefined },
    { args: ["logs", "--tail=200"], options: undefined },
    { args: ["logs", "--tail=200", "-f"], options: undefined },
    { args: ["exec", "-T", "laravel-fpm", "php", "artisan", "about"], options: undefined },
  ]);
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
