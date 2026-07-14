import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_OPERATIONS, createDockerRuntimeAdapter } from "./runtime-adapter.mjs";

test("Docker runtime adapter declares every lifecycle operation", () => {
  assert.deepEqual(RUNTIME_OPERATIONS, [
    "install", "start", "stop", "restart", "status", "health", "logs", "exec", "update", "rollback", "uninstall",
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

test("Docker runtime adapter maps server lifecycle operations to compose", () => {
  const commands = [];
  const adapter = createDockerRuntimeAdapter({
    compose: (args, options) => {
      commands.push({ args, options });
      return { status: 0, stdout: "ok" };
    },
    health: async () => ({ status: 0 }),
  });

  assert.deepEqual(adapter.start(), { ok: true, supported: true, status: 0 });
  assert.deepEqual(adapter.exec(["php", "artisan", "about"]), { ok: true, supported: true, status: 0, stdout: "ok" });
  assert.deepEqual(commands, [
    { args: ["up", "-d"], options: undefined },
    { args: ["exec", "-T", "laravel-fpm", "php", "artisan", "about"], options: undefined },
  ]);
});
