import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { removeStaleWindowsServices, runWindowsNativeAcceptance } from "./windows-runner.mjs";

test("Windows acceptance refuses host mutation unless the process is elevated", async () => {
  let touched = false;
  await assert.rejects(
    () => runWindowsNativeAcceptance({
      bundlePath: "C:\\acceptance-bundle",
      runId: "winunit1",
      repoRoot: process.cwd(),
      isElevated: () => false,
      effects: { assertServicesAbsent: () => { touched = true; } },
    }),
    /WINDOWS_ELEVATION_REQUIRED/,
  );
  assert.equal(touched, false);
});

test("Windows acceptance removes only stale Archive Suite service names before installation", async () => {
  const calls = [];
  const existing = new Set(["archive-http", "archive-postgres"]);
  const run = (command, args) => {
    calls.push([command, args]);
    const service = args[args.length - 1];
    if (args[0] === "query") return { status: existing.has(service) ? 0 : 1060 };
    if (args[0] === "delete") existing.delete(service);
    return { status: 0 };
  };

  await removeStaleWindowsServices({ run });

  assert.equal(existing.size, 0);
  assert.deepEqual(calls.filter(([, args]) => args[0] === "stop").map(([, args]) => args[1]), ["archive-postgres", "archive-http"]);
  assert.deepEqual(calls.filter(([, args]) => args[0] === "delete").map(([, args]) => args[1]), ["archive-postgres", "archive-http"]);
  assert.equal(calls.some(([, args]) => args[0] === "delete" && args[1] === "unrelated-service"), false);
});

test("Windows acceptance installs, probes, uninstalls, and proves scoped cleanup", async () => {
  const calls = [];
  const evidence = [];
  const effects = {
    assertServicesAbsent: async () => calls.push("services-absent"),
    startDependencies: async () => { calls.push("dependencies-start"); return { bundled: true }; },
    install: async ({ environment }) => { calls.push("install"); assert.equal(environment.ARCHIVE_NATIVE_POSTGRES_HOST, undefined); },
    waitForServices: async () => calls.push("bundled-data-and-six-services-active"),
    waitForHttp: async () => calls.push("http-health"),
    uninstall: async () => calls.push("uninstall"),
    proveApplicationCleanup: async () => calls.push("application-clean"),
    stopDependencies: async () => calls.push("dependencies-stop"),
    proveDependenciesAbsent: async () => { calls.push("dependencies-absent"); return true; },
    removeRunData: async () => calls.push("run-data-removed"),
  };

  const result = await runWindowsNativeAcceptance({
    bundlePath: "C:\\acceptance-bundle",
    bundleDigest: "a".repeat(64),
    runId: "winunit2",
    repoRoot: process.cwd(),
    commit: "b".repeat(40),
    version: "1.0.0",
    evidenceOutputDir: join(tmpdir(), "unused-windows-evidence"),
    isElevated: () => true,
    passwordFactory: () => "never-record-this",
    effects,
    evidenceWriter: (input) => { evidence.push(input); return "evidence.json"; },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["services-absent", "dependencies-start", "install", "bundled-data-and-six-services-active", "http-health", "uninstall", "application-clean", "services-absent", "dependencies-stop", "dependencies-absent", "run-data-removed"]);
  assert.equal(evidence[0].platform, "windows-native");
  assert.equal(evidence[0].cleanup.ok, true);
  assert.doesNotMatch(JSON.stringify(evidence[0]), /never-record-this/);
});
