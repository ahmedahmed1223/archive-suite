import assert from "node:assert/strict";
import test from "node:test";

import { DELETE_DATA_CONFIRMATION_PHRASE, createReconnectData, createUninstall } from "./uninstall.mjs";

// Same DI/mocking style as update-release.test.mjs: no Docker, no filesystem.

function baseManifest(overrides = {}) {
  return {
    version: "1.1.0",
    mode: "docker",
    source: "online",
    platform: "linux-docker",
    services: ["postgres", "redis", "next"],
    dataPaths: { storage: "/srv/archive-suite/storage" },
    releaseEnvironment: { ARCHIVE_RELEASE_PULL_POLICY: "missing", ARCHIVE_RELEASE_IMAGE_NEXT: "registry/archive-next:1.1.0@sha256:bbb" },
    ...overrides,
  };
}

function buildDeps({ manifest = baseManifest(), removeOk = true, backups, deleteOk = true, removeManifestOk = true, readError } = {}) {
  const calls = [];
  const deps = {
    manifestPath: "manifest.json",
    manifestStore: { readInstallationManifest: () => { if (readError) throw readError; return manifest; } },
    removeServices: (request) => { calls.push(["removeServices", request.deleteVolumes]); return { ok: removeOk }; },
    listBackups: () => { calls.push(["listBackups"]); return backups ?? [{ name: "b1", createdAt: new Date().toISOString(), checksum: "abc" }]; },
    deleteDataPaths: (dataPaths) => { calls.push(["deleteDataPaths", dataPaths]); if (!deleteOk) throw new Error("EACCES /private/path"); },
    removeManifest: () => { calls.push(["removeManifest"]); if (!removeManifestOk) throw new Error("EACCES /private/path"); },
  };
  return { deps, calls };
}

test("uninstall fails closed when no installation manifest exists", async () => {
  const { deps, calls } = buildDeps({ manifest: null });
  const result = await createUninstall(deps)({ confirmed: true });

  assert.equal(result.ok, false);
  assert.equal(result.code, "RELEASE_NOT_INSTALLED");
  assert.deepEqual(calls, []);
});

test("uninstall is refused for non-Docker installations with a stable code", async () => {
  const { deps } = buildDeps({ manifest: baseManifest({ mode: "native" }) });
  const result = await createUninstall(deps)({ confirmed: true });

  assert.equal(result.code, "MODE_UNSUPPORTED");
});

test("uninstall accepts a native installation when the native wiring declares support (V1-210B)", async () => {
  const { deps, calls } = buildDeps({ manifest: baseManifest({ mode: "native", services: ["archive-http", "archive-next"] }) });
  const result = await createUninstall({ ...deps, supportedModes: ["native"] })({ confirmed: true });

  assert.equal(result.ok, true);
  assert.equal(result.code, "UNINSTALL_COMPLETE");
  assert.deepEqual(result.details.removedServices, ["archive-http", "archive-next"]);
  assert.ok(calls.some(([name]) => name === "removeServices"));
});

test("uninstall requires explicit confirmation before touching any service", async () => {
  const { deps, calls } = buildDeps();
  const result = await createUninstall(deps)();

  assert.equal(result.ok, false);
  assert.equal(result.code, "UNINSTALL_CONFIRMATION_REQUIRED");
  assert.ok(result.nextActions.some((line) => line.includes("--yes")));
  assert.deepEqual(calls, []);
});

test("uninstall keeps data by default and removes only manifest-owned services", async () => {
  const { deps, calls } = buildDeps();
  const result = await createUninstall(deps)({ confirmed: true });

  assert.equal(result.ok, true);
  assert.equal(result.code, "UNINSTALL_COMPLETE");
  assert.deepEqual(result.details.keptDataPaths, { storage: "/srv/archive-suite/storage" });
  assert.deepEqual(result.details.removedServices, ["postgres", "redis", "next"]);
  assert.deepEqual(calls, [["removeServices", false], ["removeManifest"]], "no volume deletion, no data path deletion, no backup requirement for the keep-data default");
  assert.ok(result.nextActions.some((line) => line.includes("reconnect-data")), "the operator must learn how to re-attach the kept data");
});

test("uninstall with data deletion requires the exact typed confirmation phrase", async () => {
  const { deps, calls } = buildDeps();
  const uninstall = createUninstall(deps);

  for (const phrase of [undefined, "", "delete archive data", "YES"]) {
    const result = await uninstall({ confirmed: true, deleteDataRequested: true, deleteConfirmationPhrase: phrase });
    assert.equal(result.ok, false);
    assert.equal(result.code, "UNINSTALL_DELETE_PHRASE_REQUIRED");
    assert.ok(result.nextActions.some((line) => line.includes(DELETE_DATA_CONFIRMATION_PHRASE)));
  }
  assert.deepEqual(calls, [], "a wrong phrase must have zero side effects");
});

test("uninstall with data deletion requires a recent successful backup", async () => {
  const stale = new Date(Date.now() - 48 * 3_600_000).toISOString();
  for (const backups of [[], [{ name: "old", createdAt: stale, checksum: "abc" }], [{ name: "nochecksum", createdAt: new Date().toISOString() }]]) {
    const { deps, calls } = buildDeps({ backups });
    const result = await createUninstall(deps)({ confirmed: true, deleteDataRequested: true, deleteConfirmationPhrase: DELETE_DATA_CONFIRMATION_PHRASE });

    assert.equal(result.ok, false);
    assert.equal(result.code, "UNINSTALL_RECENT_BACKUP_REQUIRED");
    assert.ok(result.nextActions.some((line) => line.includes("setup backup")));
    assert.deepEqual(calls, [["listBackups"]], "no destructive step may run without a recent verified backup");
  }
});

test("uninstall with phrase and recent backup deletes volumes, data paths, and the manifest", async () => {
  const { deps, calls } = buildDeps();
  const result = await createUninstall(deps)({ confirmed: true, deleteDataRequested: true, deleteConfirmationPhrase: DELETE_DATA_CONFIRMATION_PHRASE });

  assert.equal(result.ok, true);
  assert.equal(result.code, "UNINSTALL_COMPLETE");
  assert.deepEqual(result.details.deletedDataPaths, { storage: "/srv/archive-suite/storage" });
  assert.equal(result.details.keptDataPaths, undefined);
  assert.deepEqual(calls, [["listBackups"], ["removeServices", true], ["deleteDataPaths", { storage: "/srv/archive-suite/storage" }], ["removeManifest"]]);
});

test("a failed service removal reports a stable code and leaves data and manifest untouched", async () => {
  const { deps, calls } = buildDeps({ removeOk: false });
  const result = await createUninstall(deps)({ confirmed: true });

  assert.equal(result.ok, false);
  assert.equal(result.code, "UNINSTALL_SERVICES_FAILED");
  assert.ok(result.nextActions.length > 0);
  assert.ok(!calls.some((c) => c[0] === "removeManifest" || c[0] === "deleteDataPaths"));
});

test("a failed data deletion reports a stable redacted code and keeps the manifest for a retry", async () => {
  const { deps, calls } = buildDeps({ deleteOk: false });
  const result = await createUninstall(deps)({ confirmed: true, deleteDataRequested: true, deleteConfirmationPhrase: DELETE_DATA_CONFIRMATION_PHRASE });

  assert.equal(result.ok, false);
  assert.equal(result.code, "UNINSTALL_DATA_DELETE_FAILED");
  assert.doesNotMatch(JSON.stringify(result), /\/private\/path/);
  assert.ok(!calls.some((c) => c[0] === "removeManifest"), "the manifest must survive so the deletion can be retried");
});

test("manifest I/O failures are returned as redacted structured results", async () => {
  const { deps } = buildDeps({ readError: new Error("EIO https://admin:secret@example.test") });
  const read = await createUninstall(deps)({ confirmed: true });
  assert.equal(read.code, "UNINSTALL_MANIFEST_IO_FAILED");
  assert.doesNotMatch(JSON.stringify(read), /admin:secret|example\.test/);

  const { deps: removeDeps } = buildDeps({ removeManifestOk: false });
  const removed = await createUninstall(removeDeps)({ confirmed: true });
  assert.equal(removed.code, "UNINSTALL_MANIFEST_IO_FAILED");
  assert.doesNotMatch(JSON.stringify(removed), /\/private\/path/);
});

// ─── reconnect-data ──────────────────────────────────────────────────────────

function reconnectDeps({ manifest = baseManifest(), exists = true, updateError } = {}) {
  const calls = [];
  const deps = {
    manifestPath: "manifest.json",
    manifestStore: {
      readInstallationManifest: () => manifest,
      updateDataPaths: (request) => { if (updateError) throw updateError; calls.push(["updateDataPaths", request.dataPaths]); return { ...manifest, dataPaths: request.dataPaths }; },
    },
    inspectDataPath: (path) => { calls.push(["inspect", path]); return { exists }; },
  };
  return { deps, calls };
}

test("reconnect-data requires a storage path argument", async () => {
  const { deps, calls } = reconnectDeps();
  const result = await createReconnectData(deps)({});

  assert.equal(result.ok, false);
  assert.equal(result.code, "RECONNECT_DATA_PATH_REQUIRED");
  assert.deepEqual(calls, []);
});

test("reconnect-data rejects URLs and credential-bearing paths without touching the manifest", async () => {
  const { deps, calls } = reconnectDeps();
  for (const storagePath of ["https://example.test/data", "postgres://user:secret@host/db", "user:secret@host"]) {
    const result = await createReconnectData(deps)({ storagePath });
    assert.equal(result.code, "RECONNECT_DATA_PATH_INVALID");
    assert.doesNotMatch(JSON.stringify(result), /secret|example\.test/);
  }
  assert.deepEqual(calls, []);
});

test("reconnect-data refuses a directory that does not exist", async () => {
  const { deps } = reconnectDeps({ exists: false });
  const result = await createReconnectData(deps)({ storagePath: "/mnt/old-archive/storage" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "RECONNECT_DATA_NOT_FOUND");
  assert.ok(result.nextActions.length > 0);
});

test("reconnect-data requires a fresh install to attach to", async () => {
  const { deps } = reconnectDeps({ manifest: null });
  const result = await createReconnectData(deps)({ storagePath: "/mnt/old-archive/storage" });

  assert.equal(result.code, "RELEASE_NOT_INSTALLED");
  assert.ok(result.nextActions.some((line) => line.includes("setup install")));
});

test("reconnect-data re-attaches the existing data directory to the fresh install atomically", async () => {
  const { deps, calls } = reconnectDeps();
  const result = await createReconnectData(deps)({ storagePath: "/mnt/old-archive/storage" });

  assert.equal(result.ok, true);
  assert.equal(result.code, "RECONNECT_COMPLETE");
  assert.deepEqual(calls.at(-1), ["updateDataPaths", { storage: "/mnt/old-archive/storage" }]);
  assert.ok(result.nextActions.some((line) => line.includes("restart")), "the operator must restart so services pick up the reconnected data");
});

test("reconnect-data returns a redacted structured result when the manifest write fails", async () => {
  const { deps } = reconnectDeps({ updateError: new Error("ENOSPC https://admin:secret@example.test") });
  const result = await createReconnectData(deps)({ storagePath: "/mnt/old-archive/storage" });

  assert.equal(result.code, "RECONNECT_MANIFEST_IO_FAILED");
  assert.doesNotMatch(JSON.stringify(result), /admin:secret|example\.test/);
});
