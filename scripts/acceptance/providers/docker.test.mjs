import assert from "node:assert/strict";
import test from "node:test";

import { createDockerProvider } from "./docker.mjs";

function runFake(calls, result = { status: 0, stdout: "", stderr: "" }) {
  return async (cmd, args, options) => {
    calls.push([cmd, args, options]);
    return typeof result === "function" ? result(cmd, args, options) : result;
  };
}

test("docker provider scopes every lifecycle command and passes isolated port env", async () => {
  const calls = [];
  const ports = [43123, 43124];
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-001",
    run: runFake(calls),
    getFreePort: async () => ports.shift(),
  });
  await provider.prepare();
  await provider.install();
  await provider.start();
  await provider.exec("laravel", ["php", "artisan", "about"]);
  await provider.collect();
  await provider.reset();
  await provider.destroy();
  assert.ok(calls.every(([cmd]) => cmd === "docker"));
  const composeCalls = calls.filter(([, args]) => args[0] === "compose");
  assert.equal(composeCalls.length, 8);
  const commonPrefix = ["compose", "--project-name", "archive-acceptance-run-001", "--env-file", "infra/.env.example", "--file", "infra/docker-compose.laravel-next.yml"];
  for (const [, args] of composeCalls) assert.deepEqual(args.slice(0, commonPrefix.length), commonPrefix);
  assert.ok(composeCalls.some(([, args]) => args.includes("down") && args.includes("--remove-orphans")));
  assert.ok(calls.every(([, , options]) => options.env.NEXT_PUBLIC_PORT === "43123" && options.env.REVERB_SERVER_PUBLISHED_PORT === "43124" && options.env.REVERB_PORT === "43124"));
  assert.ok(calls.every(([, , options]) => options.env !== process.env));
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
