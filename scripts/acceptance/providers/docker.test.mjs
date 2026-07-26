import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createDockerProvider } from "./docker.mjs";

const COMPOSE_FILE = new URL("../../../infra/docker-compose.laravel-next.yml", import.meta.url);

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
  const envFile = calls[0][1][4];
  assert.equal(existsSync(envFile), true);
  await provider.install();
  await provider.start();
  await provider.exec("laravel", ["php", "artisan", "about"]);
  await provider.collect();
  await provider.reset();
  await provider.destroy();
  assert.equal(existsSync(envFile), false);
  assert.ok(calls.every(([cmd]) => cmd === "docker"));
  const composeCalls = calls.filter(([, args]) => args[0] === "compose");
  assert.equal(composeCalls.length, 9);
  for (const [, args] of composeCalls) {
    assert.deepEqual(args.slice(0, 5), ["compose", "--project-name", "archive-acceptance-run-001", "--env-file", args[4]]);
    assert.match(args[4], /archive-acceptance-run-001-.*compose\.env$/i);
    assert.deepEqual(args.slice(5, 7), ["--file", "infra/docker-compose.laravel-next.yml"]);
  }
  assert.ok(composeCalls.some(([, args]) => args.includes("down") && args.includes("--remove-orphans")));
  assert.ok(calls.every(([, , options]) => options.env.NEXT_PUBLIC_PORT === "43123" && options.env.REVERB_SERVER_PUBLISHED_PORT === "43124" && options.env.REVERB_PORT === "43124"));
  assert.ok(calls.every(([, , options]) => options.env !== process.env));
  assert.equal(provider.credentials.email, "acceptance-run-001@archive.test");
  assert.match(provider.credentials.password, /^Aa1!/);
  assert.deepEqual(provider.endpoints, { next: "http://127.0.0.1:43123", api: "http://127.0.0.1:43123/api/v1" });
  assert.deepEqual(provider.describe(), {
    name: "docker",
    capabilities: ["docker"],
    project: "archive-acceptance-run-001",
    resources: { publishedPorts: { next: 43123, reverb: 43124 } },
    endpoints: { next: "http://127.0.0.1:43123", api: "http://127.0.0.1:43123/api/v1" },
    imageDigests: [],
  });
});

test("run environment defines every variable the compose file refuses to default", async () => {
  const calls = [];
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-007",
    run: runFake(calls),
    getFreePort: async () => 43127,
  });
  await provider.prepare();
  const envFile = calls[0][1][4];
  const defined = new Set(
    readFileSync(envFile, "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.slice(0, line.indexOf("="))),
  );
  // `${VAR:?message}` is Compose's "fail if unset" form — every one of those is
  // a hard requirement of the acceptance stack, so the generated env file must
  // cover them all. Derived from the compose file rather than hardcoded so a
  // newly required variable fails here instead of mid-run against Docker.
  const required = [...readFileSync(COMPOSE_FILE, "utf8").matchAll(/\$\{([A-Z0-9_]+):\?/g)].map((match) => match[1]);
  assert.ok(required.length > 0, "compose file exposes no required variables — the pattern went stale");
  const missing = [...new Set(required)].filter((name) => !defined.has(name));
  assert.deepEqual(missing, [], `compose env file is missing required variables: ${missing.join(", ")}`);
  await provider.destroy();
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

test("destroy verifies no project-owned containers, networks, or volumes remain", async () => {
  const calls = [];
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-003",
    run: runFake(calls),
    getFreePort: async () => 43124,
  });

  await provider.destroy();

  const ownershipChecks = calls
    .filter(([, args]) => args[0] !== "compose")
    .map(([, args]) => args);
  assert.deepEqual(ownershipChecks, [
    ["ps", "--all", "--filter", "label=com.docker.compose.project=archive-acceptance-run-003", "--format", "{{.ID}}"],
    ["network", "ls", "--filter", "label=com.docker.compose.project=archive-acceptance-run-003", "--format", "{{.ID}}"],
    ["volume", "ls", "--filter", "label=com.docker.compose.project=archive-acceptance-run-003", "--format", "{{.ID}}"],
  ]);
});

test("destroy fails when project-owned networks or volumes remain", async () => {
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-004",
    run: async (cmd, args) => ({
      status: 0,
      stdout: args[0] === "network" || args[0] === "volume" ? "leftover\n" : "",
      stderr: "",
    }),
    getFreePort: async () => 43124,
  });

  await assert.rejects(() => provider.destroy(), /networks, volumes/i);
});

test("rejects a project name that does not match the ownership pattern", () => {
  assert.throws(
    () => createDockerProvider({ root: "D:/repo", runId: "not valid!", run: async () => {}, getFreePort: async () => 1 }),
    /project name/i,
  );
});

test("provider forwards runner abort signals to spawned Docker work", async () => {
  const calls = [];
  const controller = new AbortController();
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-005",
    run: runFake(calls),
    getFreePort: async () => 43125,
  });
  await provider.prepare({ signal: controller.signal });
  assert.equal(calls[0][2].signal, controller.signal);
  await provider.exec("laravel", ["php", "artisan", "about"], { signal: controller.signal });
  assert.equal(calls[1][2].signal, controller.signal);
  await provider.destroy();
});

test("provider collects non-empty service image digest provenance", async () => {
  const digest = `sha256:${"a".repeat(64)}`;
  const provider = createDockerProvider({
    root: "D:/repo",
    runId: "run-006",
    run: async (cmd, args) => {
      if (args.includes("images")) {
        // `docker compose images --format json` emits ImageID, not the
        // `docker image ls`-style ID field.
        return { status: 0, stdout: `${JSON.stringify({ Service: "next", Repository: "archive-next", Tag: "rc", ImageID: digest })}\n`, stderr: "" };
      }
      if (args[0] === "compose" && args.includes("ps")) return { status: 0, stdout: JSON.stringify([{ Service: "next", State: "running" }]), stderr: "" };
      return { status: 0, stdout: args[0] === "compose" ? "[]" : "", stderr: "" };
    },
    getFreePort: async () => 43126,
  });
  await provider.prepare();
  await provider.start();
  await provider.collect();
  assert.deepEqual(provider.describe().imageDigests, [{
    service: "next",
    image: "archive-next:rc",
    digest,
  }]);
  await provider.destroy();
});
