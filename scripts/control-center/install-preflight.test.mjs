import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInstallPreflight, createHostProbes } from "./install-preflight.mjs";

// V1-208L: the two host preconditions that had no implementation to test —
// free disk space and required dependencies. Probes are injected so these
// tests never touch the real host.

const GB = 1024 ** 3;

function preflight({ free = 500 * GB, total = 1000 * GB, dependencies = {} } = {}) {
  return createInstallPreflight({
    diskProbe: () => ({ free, total }),
    dependencyProbe: (name) => dependencies[name] ?? { installed: true, version: "1.0.0" },
    requiredDependencies: Object.keys(dependencies).length ? Object.keys(dependencies) : ["docker"],
  });
}

test("passes when the host has free space and every dependency", async () => {
  const result = await preflight().run({ requiredBytes: 10 * GB });
  assert.equal(result.ok, true);
  assert.equal(result.code, "PREFLIGHT_PASSED");
});

test("insufficient disk space fails with a stable code and next actions", async () => {
  const result = await preflight({ free: 2 * GB }).run({ requiredBytes: 10 * GB });
  assert.equal(result.ok, false);
  assert.equal(result.code, "INSUFFICIENT_DISK_SPACE");
  assert.ok(result.nextActions.length > 0);
  assert.equal(result.details.requiredBytes, 10 * GB);
  assert.equal(result.details.freeBytes, 2 * GB);
});

test("a full disk reports the dedicated code, not the generic shortfall", async () => {
  const result = await preflight({ free: 0 }).run({ requiredBytes: 10 * GB });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DISK_FULL");
  assert.ok(result.nextActions.length > 0);
});

test("an explicit disk override bypasses capacity only and reports the bypass", async () => {
  const result = await preflight({ free: 0 }).run({ requiredBytes: 10 * GB, skipDiskCheck: true });
  assert.equal(result.ok, true);
  assert.equal(result.code, "PREFLIGHT_PASSED");
  assert.equal(result.details.diskCheck, "skipped-by-operator");
  assert.match(result.message, /disk capacity check was skipped/i);
});

test("a missing dependency fails with a stable code naming it", async () => {
  const result = await preflight({
    dependencies: { docker: { installed: false } },
  }).run({ requiredBytes: 1 * GB });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEPENDENCY_MISSING");
  assert.deepEqual(result.details.missing, ["docker"]);
  assert.ok(result.nextActions.length > 0);
});

test("an unreadable disk probe fails closed instead of assuming space", async () => {
  const runner = createInstallPreflight({
    diskProbe: () => {
      throw new Error("C:\\ArchiveSuite\\data is unreadable");
    },
    dependencyProbe: () => ({ installed: true }),
    requiredDependencies: ["docker"],
  });
  const result = await runner.run({ requiredBytes: 1 * GB });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DISK_PROBE_FAILED");
  // The raw path from the probe error must not leak into the operator result.
  assert.doesNotMatch(JSON.stringify(result), /ArchiveSuite/);
});

test("host disk probe converts statfs blocks into available bytes", () => {
  const probes = createHostProbes({
    dataPath: "/data",
    exists: () => true,
    statfs: (path) => {
      assert.equal(path, "/data");
      // bavail is space available to an unprivileged writer; bfree includes
      // root-reserved blocks the installer cannot actually use.
      return { bsize: 4096, bavail: 100, blocks: 500, bfree: 200 };
    },
    run: () => ({ status: 0 }),
  });
  assert.deepEqual(probes.diskProbe(), { free: 4096 * 100, total: 4096 * 500 });
});

test("host disk probe measures the nearest existing ancestor when the storage folder is not created yet", () => {
  const existing = mkdtempSync(join(tmpdir(), "archive-preflight-"));
  const requested = join(existing, "data", "storage");
  const calls = [];
  const probes = createHostProbes({
    dataPath: requested,
    exists: (path) => path === existing,
    statfs: (path) => {
      calls.push(path);
      return { bsize: 4096, bavail: 100, blocks: 500 };
    },
    run: () => ({ status: 0 }),
  });

  assert.deepEqual(probes.diskProbe(), { free: 4096 * 100, total: 4096 * 500 });
  assert.deepEqual(calls, [existing]);
});

test("host dependency probe reports docker present only on a zero exit", () => {
  const calls = [];
  const probes = createHostProbes({
    dataPath: "/data",
    statfs: () => ({ bsize: 1, bavail: 1, blocks: 1 }),
    run: (command, args) => {
      calls.push([command, args]);
      return { status: command === "docker" ? 0 : 1 };
    },
  });
  assert.deepEqual(probes.dependencyProbe("docker"), { installed: true });
  assert.deepEqual(probes.dependencyProbe("nope"), { installed: false });
  assert.deepEqual(calls, [["docker", ["--version"]], ["nope", ["--version"]]]);
});

test("host dependency probe treats a spawn failure as missing, never as present", () => {
  const probes = createHostProbes({
    dataPath: "/data",
    statfs: () => ({ bsize: 1, bavail: 1, blocks: 1 }),
    run: () => { throw new Error("ENOENT"); },
  });
  assert.deepEqual(probes.dependencyProbe("docker"), { installed: false });
});

test("dependency checks run even when disk space is the first failure", async () => {
  const result = await preflight({
    free: 0,
    dependencies: { docker: { installed: false } },
  }).run({ requiredBytes: 10 * GB });
  assert.equal(result.ok, false);
  // Disk is reported first, but the operator still sees the dependency gap so
  // they fix both in one pass instead of discovering them one retry at a time.
  assert.deepEqual(result.details.missing, ["docker"]);
});
