import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInstallPreflight } from "./install-preflight.mjs";
import { createDataProbes } from "./data-probes.mjs";

// V1-208L: the lifecycle failure matrix. Every scenario the ticket names must
// produce a stable `code` and actionable `nextActions` — never a bare throw, a
// silent success, or a leaked host path.
//
// Two layers, on purpose:
//   1. Driven scenarios below run the real module and assert the real result.
//   2. SCENARIOS is the registry gate: it fails when a listed code disappears
//      from the implementation (rename/removal), so the matrix cannot rot into
//      a list of codes nobody produces any more. It does NOT re-assert the
//      behavior each owning module's own suite already covers.

const HERE = dirname(fileURLToPath(import.meta.url));
const GB = 1024 ** 3;

/**
 * Each V1-208L scenario -> the module that owns it and the stable code it returns.
 * `driven: true` means a test in this file executes the module and asserts the
 * code directly, which is stronger evidence than a source scan — required for
 * codes composed at runtime (data-probes builds `${BACKEND}_UNAVAILABLE`), where
 * the literal never appears in the source.
 */
const SCENARIOS = [
  { scenario: "corrupted checksum", module: "release-descriptor.mjs", code: "OFFLINE_CHECKSUM_INVALID" },
  { scenario: "corrupted signature/image", module: "release-descriptor.mjs", code: "OFFLINE_IMAGE_MISMATCH" },
  { scenario: "occupied port", module: "access-mode.mjs", code: "PORT_CONFLICT" },
  { scenario: "insufficient disk space", module: "install-preflight.mjs", code: "INSUFFICIENT_DISK_SPACE", driven: true },
  { scenario: "disk full", module: "install-preflight.mjs", code: "DISK_FULL", driven: true },
  { scenario: "missing dependency", module: "install-preflight.mjs", code: "DEPENDENCY_MISSING", driven: true },
  { scenario: "database down", module: "data-probes.mjs", code: "POSTGRES_UNAVAILABLE", driven: true },
  { scenario: "cache/queue down", module: "data-probes.mjs", code: "REDIS_UNAVAILABLE", driven: true },
  { scenario: "worker/Reverb health down", module: "update-release.mjs", code: "HEALTH_CHECK_FAILED" },
  { scenario: "failed restore", module: "rollback-release.mjs", code: "ROLLBACK_RESTORE_FAILED" },
  { scenario: "failed update switch", module: "update-release.mjs", code: "SWITCH_FAILED" },
  { scenario: "failed rollback", module: "rollback-release.mjs", code: "ROLLBACK_SWITCH_FAILED" },
];

test("every source-declared failure code is still produced by its module", () => {
  const sources = new Map();
  for (const { scenario, module, code, driven } of SCENARIOS) {
    if (driven) continue; // a driven test below asserts this code against real behavior
    if (!sources.has(module)) sources.set(module, readFileSync(join(HERE, module), "utf8"));
    assert.ok(
      sources.get(module).includes(`"${code}"`),
      `scenario "${scenario}": ${module} no longer produces the code "${code}" — update the code or this registry, never leave the scenario uncovered`
    );
  }
});

test("every driven scenario is actually exercised by a test in this file", () => {
  // Guards the `driven` escape hatch: it may only be claimed for codes this
  // file really asserts, so it can never become a way to skip the gate.
  const self = readFileSync(join(HERE, "lifecycle-failures.test.mjs"), "utf8");
  const body = self.slice(self.indexOf("── Driven scenarios"));
  for (const { scenario, code, driven } of SCENARIOS) {
    if (!driven) continue;
    assert.ok(
      body.includes(`"${code}"`),
      `scenario "${scenario}" is marked driven but no driven test asserts "${code}"`
    );
  }
});

test("the scenario registry has no duplicate codes", () => {
  const codes = SCENARIOS.map((s) => s.code);
  assert.equal(new Set(codes).size, codes.length, "each lifecycle failure needs its own distinguishable code");
});

// ── Driven scenarios ────────────────────────────────────────────────────────

test("insufficient disk space and disk full are distinguishable and actionable", async () => {
  const build = (free) =>
    createInstallPreflight({
      diskProbe: () => ({ free, total: 100 * GB }),
      dependencyProbe: () => ({ installed: true }),
      requiredDependencies: ["docker"],
    }).run({ requiredBytes: 10 * GB });

  const short = await build(2 * GB);
  assert.equal(short.code, "INSUFFICIENT_DISK_SPACE");
  assert.ok(short.nextActions.length > 0);

  const full = await build(0);
  assert.equal(full.code, "DISK_FULL");
  assert.ok(full.nextActions.length > 0);
});

test("a missing dependency stops the install with an actionable code", async () => {
  const result = await createInstallPreflight({
    diskProbe: () => ({ free: 50 * GB, total: 100 * GB }),
    dependencyProbe: (name) => ({ installed: name !== "docker" }),
    requiredDependencies: ["docker"],
  }).run({ requiredBytes: 1 * GB });

  assert.equal(result.ok, false);
  assert.equal(result.code, "DEPENDENCY_MISSING");
  assert.deepEqual(result.details.missing, ["docker"]);
  assert.ok(result.nextActions.length > 0);
});

test("a database that is down reports a stable redacted code", async () => {
  const result = await createDataProbes({
    postgres: {
      query: async () => {
        throw new Error("connection refused to postgres://archive:s3cr3t@db-host:5432/archive");
      },
    },
  }).postgres();

  assert.equal(result.ok, false);
  assert.equal(result.code, "POSTGRES_UNAVAILABLE");
  assert.ok(result.nextActions.length > 0);
  // The credential in the driver error must never reach the operator result.
  assert.doesNotMatch(JSON.stringify(result), /s3cr3t/);
});

test("a cache/queue that is down reports a stable redacted code", async () => {
  const result = await createDataProbes({
    redis: {
      set: async () => {
        throw new Error("connection refused to redis://:hunter2@cache-host:6379");
      },
    },
  }).redis();

  assert.equal(result.ok, false);
  assert.equal(result.code, "REDIS_UNAVAILABLE");
  assert.ok(result.nextActions.length > 0);
  assert.doesNotMatch(JSON.stringify(result), /hunter2/);
});

test("running preflight twice with the same host state is idempotent", async () => {
  const runner = createInstallPreflight({
    diskProbe: () => ({ free: 2 * GB, total: 100 * GB }),
    dependencyProbe: () => ({ installed: true }),
    requiredDependencies: ["docker"],
  });
  const first = await runner.run({ requiredBytes: 10 * GB });
  const second = await runner.run({ requiredBytes: 10 * GB });
  // A read-only check must not drift between runs — same host, same verdict.
  assert.deepEqual(first, second);
});
