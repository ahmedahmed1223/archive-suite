import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runLinuxNativeAcceptance } from "./linux-runner.mjs";

function bundleFixture() {
  const root = mkdtempSync(join(tmpdir(), "linux-native-runner-"));
  mkdirSync(join(root, "runtime", "node", "bin"), { recursive: true });
  writeFileSync(join(root, "runtime", "node", "bin", "node"), "node\n");
  return root;
}

test("Linux acceptance always installs, verifies six services and HTTP, uninstalls, and proves Docker cleanup", async () => {
  const calls = [];
  const removed = new Set();
  const docker = (args) => {
    calls.push(args);
    if (args[0] === "rm") args.filter((value) => value.startsWith("archive-native-")).forEach((value) => removed.add(value));
    if (args[0] === "network" && args[1] === "rm") removed.add(args[2]);
    if ((args[0] === "inspect" || (args[0] === "network" && args[1] === "inspect")) && removed.has(args.at(-1))) return { status: 1, stdout: "", stderr: "not found" };
    return { status: 0, stdout: args[0] === "run" ? "container-id\n" : "", stderr: "" };
  };
  const evidence = [];

  const result = await runLinuxNativeAcceptance({
    bundlePath: bundleFixture(),
    runId: "unit1234",
    docker,
    evidenceWriter: (input) => evidence.push(input),
    evidenceOutputDir: join(tmpdir(), "unused-evidence"),
    repoRoot: process.cwd(),
    commit: "a".repeat(40),
    version: "1.0.0",
    passwordFactory: () => "ephemeral-test-value",
    systemdImage: "archive-native-systemd:test",
    postgresImage: "postgres:test",
    redisImage: "redis:test",
  });

  assert.equal(result.ok, true);
  const flattened = calls.map((args) => args.join(" ")).join("\n");
  assert.match(flattened, /network create --label archive\.acceptance\.run=unit1234 archive-native-net-unit1234/);
  assert.match(flattened, /control-center\.mjs install --config=\/tmp\/setup\.json --skip-disk-check --json/);
  for (const service of ["archive-http", "archive-next", "archive-php-fpm", "archive-worker", "archive-reverb", "archive-scheduler"]) {
    assert.match(flattened, new RegExp(`systemctl is-active ${service}`));
  }
  assert.match(flattened, /curl -fsS http:\/\/127\.0\.0\.1:8443\//);
  assert.match(flattened, /control-center\.mjs uninstall --yes --json/);
  assert.match(flattened, /network rm archive-native-net-unit1234/);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].platform, "linux-native");
  assert.equal(evidence[0].cleanup.ok, true);
  assert.doesNotMatch(JSON.stringify(evidence[0]), /ephemeral-test-value/);
});

test("Linux acceptance reports bounded service diagnostics without exposing its ephemeral password", async () => {
  const calls = [];
  const removed = new Set();
  const docker = (args) => {
    calls.push(args);
    const command = args.join(" ");
    if (args[0] === "rm") args.filter((value) => value.startsWith("archive-native-")).forEach((value) => removed.add(value));
    if (args[0] === "network" && args[1] === "rm") removed.add(args[2]);
    if ((args[0] === "inspect" || (args[0] === "network" && args[1] === "inspect")) && removed.has(args.at(-1))) return { status: 1, stdout: "", stderr: "not found" };
    if (command.includes("systemctl is-active archive-scheduler")) return { status: 3, stdout: "inactive\n", stderr: "" };
    if (command.includes("journalctl")) return { status: 0, stdout: "scheduler failed near ephemeral-test-value\n", stderr: "" };
    if (command.includes("systemctl show archive-scheduler")) return { status: 0, stdout: "Result=exit-code\nExecMainStatus=1\n", stderr: "" };
    return { status: 0, stdout: "", stderr: "" };
  };

  await assert.rejects(
    () => runLinuxNativeAcceptance({
      bundlePath: bundleFixture(),
      runId: "fail1234",
      docker,
      evidenceWriter: () => assert.fail("failed acceptance must not write evidence"),
      evidenceOutputDir: join(tmpdir(), "unused-evidence"),
      repoRoot: process.cwd(),
      commit: "a".repeat(40),
      version: "1.0.0",
      passwordFactory: () => "ephemeral-test-value",
      serviceAttempts: 1,
    }),
    (error) => /ExecMainStatus=1/.test(error.message) && !/ephemeral-test-value/.test(error.message),
  );
  assert.ok(calls.some((args) => args.join(" ").includes("journalctl")));
  assert.ok(calls.some((args) => args[0] === "network" && args[1] === "rm"));
});
