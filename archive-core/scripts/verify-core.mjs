import assert from "node:assert/strict";
import * as core from "../src/core/index.js";

// Dependency-free contract tests for @archive/core. The package ships source
// ESM with no runtime deps, so this runs under plain Node with no install.

let failures = 0;
function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}\n  ${err.message}`);
  }
}

run("ports expose method contracts + validators", () => {
  assert.deepEqual(core.STORAGE_PROVIDER_METHODS, [
    "open", "get", "getAll", "put", "add", "delete", "clear", "putBatch", "deleteBatch",
    "snapshot", "replaceAll"
  ]);
  assert.deepEqual(core.FILE_STORE_METHODS, ["putBlob", "getBlob", "getUrl", "remove", "list"]);
  assert.deepEqual(core.AUTH_PROVIDER_METHODS, ["hashSecret", "verifySecret", "validateStrength", "isLegacyHash"]);
  assert.deepEqual(core.SESSION_PROVIDER_METHODS, ["signIn", "signOut", "getCurrentUser", "getToken", "onChange"]);
  assert.deepEqual(core.SYNC_PROVIDER_METHODS, [
    "stampMetadata", "planIncoming", "mergeIntoLocal", "detectConflicts", "buildFieldDiff",
    "summarizeConflictPlan", "filterDelta", "buildSyncFloor", "subscribe", "pushChange", "pullSince"
  ]);
  assert.deepEqual(core.AI_PROVIDER_METHODS, [
    "isAvailable", "transcribe", "summarize", "suggestTags", "proofread",
    "autocompleteFields", "chat", "rankSearch"
  ]);

  for (const isX of [core.isStorageProvider, core.isFileStore, core.isAuthProvider, core.isSessionProvider, core.isSyncProvider, core.isAiProvider]) {
    assert.equal(isX(null), false);
    assert.equal(isX({}), false);
  }
  const storage = Object.fromEntries(core.STORAGE_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(core.isStorageProvider(storage), true);
  const session = Object.fromEntries(core.SESSION_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(core.isSessionProvider(session), true);
});

run("registry getters throw before configuration (pure DI)", () => {
  assert.throws(() => core.getStorageProvider(), /not configured/);
  assert.throws(() => core.getFileStore(), /not configured/);
  assert.throws(() => core.getAuthProvider(), /not configured/);
  assert.throws(() => core.getSessionProvider(), /not configured/);
  assert.throws(() => core.getSyncProvider(), /not configured/);
  assert.throws(() => core.getAiProvider(), /not configured/);
});

run("registry register + get + reject invalid", () => {
  const make = (methods) => Object.fromEntries(methods.map((m) => [m, () => {}]));

  const storage = make(core.STORAGE_PROVIDER_METHODS);
  assert.equal(core.registerStorageProvider(storage), storage);
  assert.equal(core.getStorageProvider(), storage);
  assert.throws(() => core.registerStorageProvider({}), /StorageProvider port/);

  const files = make(core.FILE_STORE_METHODS);
  core.registerFileStore(files);
  assert.equal(core.getFileStore(), files);

  const auth = make(core.AUTH_PROVIDER_METHODS);
  core.registerAuthProvider(auth);
  assert.equal(core.getAuthProvider(), auth);

  const session = make(core.SESSION_PROVIDER_METHODS);
  core.registerSessionProvider(session);
  assert.equal(core.getSessionProvider(), session);

  const sync = make(core.SYNC_PROVIDER_METHODS);
  core.registerSyncProvider(sync);
  assert.equal(core.getSyncProvider(), sync);

  const ai = make(core.AI_PROVIDER_METHODS);
  core.registerAiProvider(ai);
  assert.equal(core.getAiProvider(), ai);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll core contract tests passed.");
