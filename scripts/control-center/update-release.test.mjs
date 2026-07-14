import assert from "node:assert/strict";
import test from "node:test";

import { createReleaseUpdate } from "./update-release.mjs";

// These tests mock every dependency the same way runtime-adapter.test.mjs
// mocks compose() and operations.test.mjs mocks adapter.exec — no Docker,
// no real release descriptor, no filesystem.

function baseManifest(overrides = {}) {
  return {
    version: "1.0.0",
    mode: "docker",
    source: "online",
    platform: "linux-docker",
    runtimeProfiles: ["core"],
    capabilities: [],
    releaseEnvironment: { ARCHIVE_RELEASE_PULL_POLICY: "missing", ARCHIVE_RELEASE_IMAGE_NEXT: "registry/archive-next:1.0.0@sha256:aaaaaaaa" },
    dataPaths: { storage: "/srv/archive-suite/storage" },
    ...overrides,
  };
}

function fakeManifestStore(manifest, failures = {}) {
  const calls = [];
  let current = manifest;
  return {
    calls,
    readInstallationManifest: () => { if (failures.read) throw failures.read; return current; },
    beginOperation: (request) => { if (failures.begin) throw failures.begin; calls.push(["begin", request.type, request.target?.version]); },
    updateLastSuccessfulStep: (request) => { const error = typeof failures.step === "function" ? failures.step(request.step) : failures.step instanceof Error ? failures.step : failures.step?.[request.step]; if (error) throw error; calls.push(["success", request.step]); },
    markInstallationFailed: (request) => { if (failures.fail) throw failures.fail; calls.push(["failed", request.failedStep, request.nextActions]); },
    completeUpdateOperation: (request) => { if (failures.complete) throw failures.complete; calls.push(["complete", request.previousVersion, request.step]); current = { ...current, version: request.input.version, previousVersion: request.previousVersion }; },
  };
}

function buildDeps({ manifest = baseManifest(), release, resolveReleaseImpl, backupOk = true, migrationOk = true, healthOk = true, smokeOk = true, pullOk = true, switchOk = true, restoreOk = true, offline = false, manifestFailures } = {}) {
  const store = fakeManifestStore(manifest, manifestFailures);
  const adapters = [];
  const restoreCalls = [];
  const resolvedRelease = release ?? {
    descriptor: { version: "1.1.0" },
    environment: { ARCHIVE_RELEASE_IMAGE_NEXT: "ghcr.io/archive-suite/next:1.1.0@sha256:" + "b".repeat(64) },
    artifacts: [{ id: "next", digest: "sha256:" + "b".repeat(64) }],
    images: [{ service: "next" }],
  };
  const deps = {
    manifestPath: "manifest.json",
    manifestStore: store,
    resolveRelease: resolveReleaseImpl ?? (() => resolvedRelease),
    loadOfflineReleaseImages: () => { deps.offlineLoaded = true; },
    configurationFromManifest: (m) => ({ mode: m.mode, source: offline ? "offline" : m.source, platform: m.platform, runtimeProfiles: m.runtimeProfiles, capabilities: m.capabilities }),
    buildAdapter: (environment = {}) => {
      const adapter = {
        environment, execCalls: [], pull: () => ({ ok: pullOk, status: pullOk ? 0 : 1 }),
        start: () => ({ ok: switchOk, status: switchOk ? 0 : 1 }),
        stop: () => ({ ok: true, status: 0 }),
        exec: (args) => { adapter.execCalls.push(args); return { status: migrationOk ? 0 : 1, stdout: migrationOk ? "" : "rollback: run artisan migrate:rollback" }; },
      };
      adapters.push(adapter);
      return adapter;
    },
    runBackup: () => (backupOk ? { ok: true, message: "Backup created.", details: { backup: { name: "b1" } } } : { ok: false, message: "Disk full.", details: {} }),
    runMigration: (adapter) => { const result = adapter.exec(["php", "artisan", "archive:migrate-safe"]); return { ok: result.status === 0, status: result.status, output: result.stdout || undefined }; },
    checkHealth: async () => (healthOk ? { ok: true, status: 200 } : { ok: false, status: 503 }),
    runRoleSmoke: async () => (smokeOk ? { ok: true, checkedRoles: ["operator"] } : { ok: false, message: "operator smoke failed" }),
    restorePreviousRelease: async (request) => { restoreCalls.push(request.cause); return { ok: restoreOk, status: restoreOk ? 0 : 1 }; },
    output: { titleLine: () => {} },
  };
  return { deps, store, adapters, restoreCalls, resolvedRelease };
}

test("update fast-fails when already on the target version, with zero side effects", async () => {
  const manifest = baseManifest({ version: "1.1.0" });
  const { deps, store } = buildDeps({ manifest, release: { descriptor: { version: "1.1.0" } } });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, true);
  assert.equal(result.code, "ALREADY_UP_TO_DATE");
  assert.deepEqual(store.calls, [], "no manifest write must occur when there is nothing to update");
});

test("update fails closed with no manifest recorded when there is no installation yet", async () => {
  const { deps, store } = buildDeps({ manifest: null });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "RELEASE_NOT_INSTALLED");
  assert.deepEqual(store.calls, []);
});

test("a bad release descriptor (signature/digest/offline checksum) aborts before any side effect", async () => {
  class FakeReleaseDescriptorError extends Error {
    constructor() { super("Release descriptor image references must be immutable version+SHA-256 digests."); this.code = "RELEASE_DESCRIPTOR_INVALID"; this.nextActions = ["Correct the release descriptor."]; }
  }
  const { deps, store, adapters } = buildDeps({ resolveReleaseImpl: () => { throw new FakeReleaseDescriptorError(); } });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "RELEASE_DESCRIPTOR_INVALID");
  assert.deepEqual(store.calls, [], "resolveRelease throwing must not touch the manifest");
  assert.deepEqual(adapters, [], "no adapter (and so no backup/pull/migrate/switch) must be built before preflight passes");
});

test("a backup failure aborts before any image pull, and reports the stack unchanged", async () => {
  const { deps, store, adapters } = buildDeps({ backupOk: false });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "BACKUP_FAILED");
  assert.match(result.message, /Disk full|Backup failed/);
  assert.equal(result.details.imagesSwitched, false);
  assert.equal(result.details.previousVersion, "1.0.0");
  assert.deepEqual(store.calls, [
    ["begin", "update", "1.1.0"],
    ["success", "preflight-verified"],
    ["failed", "backup-created", result.nextActions],
  ]);
  // Only the old adapter (for the backup attempt) was ever built — no new
  // adapter for a pull, and pull() was never called on anything.
  assert.equal(adapters.length, 1);
  assert.ok(result.nextActions.some((line) => /unchanged/i.test(line)));
});

test("an image pull/signature failure aborts before migrate-safe runs", async () => {
  const { deps, store, adapters } = buildDeps({ pullOk: false });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "IMAGE_PULL_FAILED");
  assert.equal(result.details.imagesSwitched, false);
  assert.deepEqual(store.calls.map((c) => c[0] + (c[1] ? ":" + c[1] : "")), ["begin:update", "success:preflight-verified", "success:backup-created", "failed:new-version-pulled"]);
  // The old adapter's exec() (migrate-safe) must never have been invoked.
  const oldAdapter = adapters[0];
  assert.deepEqual(oldAdapter.execCalls, []);
});

test("offline source loads the verified bundle instead of pulling, and still aborts cleanly on failure", async () => {
  const { deps, store } = buildDeps({ offline: true });
  deps.loadOfflineReleaseImages = () => { throw Object.assign(new Error("Offline bundle checksum verification failed."), { code: "OFFLINE_CHECKSUM_INVALID" }); };
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "OFFLINE_CHECKSUM_INVALID");
  assert.equal(store.calls.at(-1)[1], "new-version-pulled");
});

test("a migrate-safe failure is reported distinctly from a pre-migrate failure, surfacing its output", async () => {
  const { deps, store } = buildDeps({ migrationOk: false });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "MIGRATION_FAILED");
  assert.equal(result.details.imagesSwitched, false);
  assert.equal(store.calls.at(-1)[1], "migrated");
  assert.ok(result.nextActions.some((line) => line.includes("rollback: run artisan migrate:rollback")), "migrate-safe's own printed rollback instructions must reach nextActions");
});

test("a health failure after a successful switch restores the previous version and preserves its reference", async () => {
  const { deps, store } = buildDeps({ healthOk: false });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "HEALTH_CHECK_FAILED");
  assert.equal(result.details.imagesSwitched, false, "a failed health gate must not leave the new images active");
  assert.equal(result.details.restoredPreviousRelease, true);
  assert.equal(result.details.previousVersion, "1.0.0");
  assert.deepEqual(store.calls.map((c) => c[0] + (c[1] ? ":" + c[1] : "")), [
    "begin:update", "success:preflight-verified", "success:backup-created", "success:new-version-pulled", "success:migrated", "success:switched", "failed:health-verified",
  ]);
  assert.ok(!store.calls.some((c) => c[0] === "complete"), "the manifest must never be flipped to the new version when health fails");
});

test("a switch failure restores the previous release and records the attempted target without reporting a raw error", async () => {
  const { deps, store } = buildDeps({ switchOk: false });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "SWITCH_FAILED");
  assert.equal(result.details.restoredPreviousRelease, true);
  assert.equal(result.details.previousVersion, "1.0.0");
  assert.equal(store.calls[0][2], "1.1.0", "the in-progress manifest must name the target release");
  assert.equal(store.calls.at(-1)[0], "failed");
  assert.match(result.nextActions.join(" "), /restored/i);
});

test("a health failure restores the old release before returning a safe failure", async () => {
  const { deps, store } = buildDeps({ healthOk: false });
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "HEALTH_CHECK_FAILED");
  assert.equal(result.details.restoredPreviousRelease, true);
  assert.equal(store.calls.at(-1)[0], "failed");
  assert.match(result.nextActions.join(" "), /previous version|restored/i);
});

test("role-based smoke runs after health and restores the old release when it fails", async () => {
  const { deps, store } = buildDeps({ smokeOk: false });
  const order = [];
  deps.checkHealth = async () => { order.push("health"); return { ok: true, status: 200 }; };
  deps.runRoleSmoke = async () => { order.push("smoke"); return { ok: false, message: "operator smoke failed" }; };
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLE_SMOKE_FAILED");
  assert.deepEqual(order, ["health", "smoke"]);
  assert.equal(result.details.restoredPreviousRelease, true);
  assert.equal(store.calls.at(-1)[1], "role-smoke-verified");
});

for (const [name, failure] of [
  ["begin", { begin: new Error("disk full https://admin:secret@example.test") }],
  ["step", { step: new Error("disk full https://admin:secret@example.test") }],
  ["fail", { fail: new Error("disk full https://admin:secret@example.test") }],
  ["complete", { complete: new Error("disk full https://admin:secret@example.test") }],
]) {
  test(`manifest ${name} I/O failure is returned as a redacted structured update result`, async () => {
    const { deps } = buildDeps({ manifestFailures: failure, backupOk: name === "fail" ? false : true });
    const result = await createReleaseUpdate(deps)();

    assert.equal(result.ok, false);
    assert.equal(result.code, "UPDATE_MANIFEST_IO_FAILED");
    assert.doesNotMatch(JSON.stringify(result), /admin:secret|example\.test/);
    assert.ok(Array.isArray(result.nextActions));
  });
}

for (const [name, failure] of [
  ["switched progress", { step: { switched: new Error("disk full") } }],
  ["health progress", { step: { "health-verified": new Error("disk full") } }],
  ["smoke progress", { step: { "role-smoke-verified": new Error("disk full") } }],
  ["completion", { complete: new Error("disk full") }],
]) {
  test(`post-switch manifest ${name} failure restores the previous release before returning JSON-safe I/O failure`, async () => {
    const { deps, restoreCalls } = buildDeps({ manifestFailures: failure });
    const result = await createReleaseUpdate(deps)();

    assert.equal(result.code, "UPDATE_MANIFEST_IO_FAILED");
    assert.equal(result.details.restoredPreviousRelease, true);
    assert.equal(restoreCalls.length, 1);
  });
}

test("full success updates the manifest version, previousVersion, and operation status, and prunes nothing", async () => {
  const { deps, store } = buildDeps();
  const update = createReleaseUpdate(deps);

  const result = await update();

  assert.equal(result.ok, true);
  assert.equal(result.code, "UPDATE_COMPLETE");
  assert.equal(result.details.version, "1.1.0");
  assert.equal(result.details.previousVersion, "1.0.0");
  const complete = store.calls.find((c) => c[0] === "complete");
  assert.ok(complete, "completeUpdateOperation must be called on full success");
  assert.equal(complete[1], "1.0.0", "previousVersion must be the version being replaced");
  assert.deepEqual(store.calls.map((c) => c[0]), [
    "begin", "success", "success", "success", "success", "success", "success", "success", "complete",
  ]);
});
