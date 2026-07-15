import assert from "node:assert/strict";
import test from "node:test";

import { createReleaseRollback } from "./rollback-release.mjs";

// Same DI/mocking style as update-release.test.mjs: no Docker, no filesystem.

function baseManifest(overrides = {}) {
  const release = (version, image) => ({
    version,
    mode: "docker",
    source: "online",
    platform: "linux-docker",
    runtimeProfiles: ["core"],
    capabilities: [],
    artifacts: [{ id: "next", digest: `sha256:${image.repeat(64)}` }],
    services: ["next"],
    releaseEnvironment: { ARCHIVE_RELEASE_PULL_POLICY: "missing", ARCHIVE_RELEASE_IMAGE_NEXT: `registry/archive-next:${version}@sha256:${image.repeat(8)}` },
    dataPaths: { storage: "/srv/archive-suite/storage" },
  });
  return { ...release("1.1.0", "b"), previousRelease: release("1.0.0", "a"), ...overrides };
}

function fakeManifestStore(manifest, failures = {}) {
  const calls = [];
  return {
    calls,
    readInstallationManifest: () => { if (failures.read) throw failures.read; return manifest; },
    beginOperation: (request) => { if (failures.begin) throw failures.begin; calls.push(["begin", request.type, request.target?.version]); },
    updateLastSuccessfulStep: (request) => { const error = failures.step instanceof Error ? failures.step : failures.step?.[request.step]; if (error) throw error; calls.push(["success", request.step]); },
    markInstallationFailed: (request) => { if (failures.fail) throw failures.fail; calls.push(["failed", request.failedStep, request.nextActions]); },
    completeRollbackOperation: (request) => { if (failures.complete) throw failures.complete; calls.push(["complete", request.step]); },
  };
}

function buildDeps({ manifest = baseManifest(), impact, switchOk = true, stopOk = true, restoreBackupOk = true, healthOk = true, restoreCurrentOk = true, manifestFailures } = {}) {
  const store = fakeManifestStore(manifest, manifestFailures);
  const adapters = [];
  const restoreCurrentCalls = [];
  const restoreBackupCalls = [];
  const deps = {
    manifestPath: "manifest.json",
    manifestStore: store,
    buildAdapter: (environment = {}) => {
      const adapter = {
        environment,
        start: () => ({ ok: adapters.length > 1 ? switchOk : true, status: 0 }),
        stop: () => ({ ok: stopOk, status: stopOk ? 0 : 1 }),
      };
      adapters.push(adapter);
      return adapter;
    },
    assessRollbackImpact: async () => impact ?? { ok: true, compatible: true, reversible: true, dataLossImpact: [] },
    runRestoreBackup: async (adapter) => { restoreBackupCalls.push(adapter.environment); return restoreBackupOk ? { ok: true, message: "Restored." } : { ok: false, message: "Backup restore failed." }; },
    checkHealth: async () => (healthOk ? { ok: true, status: 200 } : { ok: false, status: 503 }),
    restoreCurrentRelease: async (request) => { restoreCurrentCalls.push(request.cause); return { ok: restoreCurrentOk }; },
  };
  return { deps, store, adapters, restoreCurrentCalls, restoreBackupCalls };
}

test("rollback fails closed when no installation manifest exists", async () => {
  const { deps, store } = buildDeps({ manifest: null });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "RELEASE_NOT_INSTALLED");
  assert.deepEqual(store.calls, []);
});

test("rollback is refused for non-Docker installations with a stable code", async () => {
  const { deps } = buildDeps({ manifest: baseManifest({ mode: "native" }) });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.code, "MODE_UNSUPPORTED");
});

test("rollback without a recorded previous release reference is refused before any side effect", async () => {
  const { deps, store, adapters } = buildDeps({ manifest: baseManifest({ previousRelease: undefined }) });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLLBACK_REFERENCE_MISSING");
  assert.deepEqual(store.calls, []);
  assert.deepEqual(adapters, []);
  assert.ok(result.nextActions.length > 0);
});

test("a previous release without pinned images is refused with the same stable code", async () => {
  const manifest = baseManifest();
  delete manifest.previousRelease.releaseEnvironment;
  const { deps } = buildDeps({ manifest });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.code, "ROLLBACK_REFERENCE_MISSING");
});

test("an incompatible downgrade (mode/platform mismatch) is refused with a stable code", async () => {
  const manifest = baseManifest();
  manifest.previousRelease.platform = "windows-10-11-docker";
  const { deps, store } = buildDeps({ manifest });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLLBACK_INCOMPATIBLE");
  assert.deepEqual(store.calls, [], "an incompatible downgrade must never begin the rollback operation");
});

test("an impact assessment declaring incompatibility refuses the downgrade", async () => {
  const { deps } = buildDeps({ impact: { ok: true, compatible: false, reversible: true, dataLossImpact: [] } });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.code, "ROLLBACK_INCOMPATIBLE");
});

test("an unknown migration impact refuses a silent rollback", async () => {
  const { deps } = buildDeps({ impact: { ok: false } });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLLBACK_IMPACT_UNKNOWN");
  assert.ok(result.nextActions.length > 0);
});

test("irreversible migrations require explicit confirmation and surface the data-loss impact", async () => {
  const impact = { ok: true, compatible: true, reversible: false, dataLossImpact: ["Records created after the update will be lost."] };
  const { deps, store, adapters } = buildDeps({ impact });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLLBACK_CONFIRMATION_REQUIRED");
  assert.deepEqual(result.details.dataLossImpact, impact.dataLossImpact);
  assert.ok(result.nextActions.some((line) => line.includes("--yes")));
  assert.deepEqual(store.calls, [], "no manifest write before confirmation");
  assert.deepEqual(adapters, [], "no adapter side effects before confirmation");
});

test("a confirmed irreversible rollback restores the pre-update backup after switching", async () => {
  const impact = { ok: true, compatible: true, reversible: false, dataLossImpact: ["Post-update data will be lost."] };
  const { deps, store, restoreBackupCalls } = buildDeps({ impact });
  const result = await createReleaseRollback(deps)({ confirmed: true });

  assert.equal(result.ok, true);
  assert.equal(result.code, "ROLLBACK_COMPLETE");
  assert.equal(restoreBackupCalls.length, 1, "the pre-update backup must be restored for irreversible migrations");
  assert.ok(store.calls.some((c) => c[0] === "success" && c[1] === "backup-restored"));
});

test("a reversible rollback switches images without touching backups and completes the manifest", async () => {
  const { deps, store, restoreBackupCalls } = buildDeps();
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, true);
  assert.equal(result.code, "ROLLBACK_COMPLETE");
  assert.equal(result.details.version, "1.0.0");
  assert.equal(result.details.rolledBackFrom, "1.1.0");
  assert.deepEqual(restoreBackupCalls, []);
  assert.deepEqual(store.calls.map((c) => c[0] + ":" + (c[1] ?? "")), [
    "begin:rollback", "success:preflight-verified", "success:switched", "success:health-verified", "complete:health-verified",
  ]);
});

test("rollback succeeds even when the currently running release is unhealthy (post-update failure recovery)", async () => {
  // The acceptance case: update completed, then the new release started
  // failing health — a standalone `setup rollback` must still return to the
  // previous pinned release without consulting the broken release's health.
  const { deps } = buildDeps();
  deps.checkHealth = async () => ({ ok: true, status: 200 });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, true);
  assert.equal(result.code, "ROLLBACK_COMPLETE");
});

test("a switch failure attempts to restore the current release and reports a stable code", async () => {
  const { deps, store, restoreCurrentCalls } = buildDeps({ switchOk: false });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLLBACK_SWITCH_FAILED");
  assert.equal(result.details.restoredCurrentRelease, true);
  assert.equal(restoreCurrentCalls.length, 1);
  assert.equal(store.calls.at(-1)[0], "failed");
  assert.ok(result.nextActions.length > 0);
});

test("a failed backup restore refuses to silently flip forward and instructs verification", async () => {
  const impact = { ok: true, compatible: true, reversible: false, dataLossImpact: ["impact"] };
  const { deps, restoreCurrentCalls } = buildDeps({ impact, restoreBackupOk: false });
  const result = await createReleaseRollback(deps)({ confirmed: true });

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLLBACK_RESTORE_FAILED");
  assert.deepEqual(restoreCurrentCalls, [], "data state is uncertain; never auto-switch forward after a failed restore");
  assert.ok(result.nextActions.length > 0);
});

test("a failed health check after rollback reports a stable code without flipping forward", async () => {
  const { deps, restoreCurrentCalls, store } = buildDeps({ healthOk: false });
  const result = await createReleaseRollback(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "ROLLBACK_HEALTH_CHECK_FAILED");
  assert.deepEqual(restoreCurrentCalls, []);
  assert.equal(store.calls.at(-1)[1], "health-verified");
  assert.ok(!store.calls.some((c) => c[0] === "complete"));
});

for (const [name, failure] of [
  ["read", { read: new Error("EIO https://admin:secret@example.test") }],
  ["begin", { begin: new Error("ENOSPC https://admin:secret@example.test") }],
  ["complete", { complete: new Error("ENOSPC https://admin:secret@example.test") }],
]) {
  test(`manifest ${name} I/O failure returns a redacted structured rollback result`, async () => {
    const { deps } = buildDeps({ manifestFailures: failure });
    const result = await createReleaseRollback(deps)();

    assert.equal(result.ok, false);
    assert.equal(result.code, "ROLLBACK_MANIFEST_IO_FAILED");
    assert.doesNotMatch(JSON.stringify(result), /admin:secret|example\.test/);
    assert.ok(Array.isArray(result.nextActions) && result.nextActions.length > 0);
  });
}
