import test from "node:test";
import assert from "node:assert/strict";
import { createInstallPreflight } from "./install-preflight.mjs";

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
