import assert from "node:assert/strict";

import {
  buildConfigView, validateDbUrl, mergeDbConfig, validateFileStoreConfig,
  mergeFileStoreConfig, testPostgresConnection
} from "../src/api/adminConfig.js";
import { resolveServerConfig } from "../src/config/serverConfig.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";

// Admin DB-config: pure helpers + injectable connection test + the admin-only
// HTTP endpoints (GET config, POST db/test, POST config).

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

run("buildConfigView masks password + carries source/target", () => {
  const view = buildConfigView({
    databaseUrl: "postgresql://archive:topsecret@postgres:5432/archive",
    databaseEngine: "postgresql",
    databaseSource: "env",
    databaseTarget: "bundled",
    fileStore: "dropbox",
    fileStoreSource: "file",
    dropboxAccessToken: "dropbox-secret",
    dropboxRefreshToken: "refresh-secret",
    dropboxAppKey: "app-key",
    dropboxAppSecret: "app-secret",
    dropboxRootPath: "/archive",
    dropboxSelectUser: "dbid:user1"
  });
  assert.equal(view.database.engine, "postgresql");
  assert.equal(view.database.url, "postgresql://archive:***@postgres:5432/archive");
  assert.equal(view.database.source, "env");
  assert.equal(view.database.target, "bundled");
  assert.equal(view.fileStore.kind, "dropbox");
  assert.equal(view.fileStore.source, "file");
  assert.deepEqual(view.fileStore.dropbox, {
    rootPath: "/archive",
    appKey: "app-key",
    selectUser: "dbid:user1",
    selectAdmin: "",
    hasAccessToken: true,
    hasRefreshToken: true,
    hasAppSecret: true
  });
  assert.equal(JSON.stringify(view).includes("dropbox-secret"), false);
  assert.equal(JSON.stringify(view).includes("refresh-secret"), false);
  assert.equal(JSON.stringify(view).includes("app-secret"), false);
});

run("validateDbUrl accepts valid, rejects junk (400)", () => {
  assert.equal(validateDbUrl(" postgresql://u:p@h:5432/db "), "postgresql://u:p@h:5432/db");
  assert.equal(validateDbUrl("mysql://u:p@h:3306/db", "mysql"), "mysql://u:p@h:3306/db");
  assert.equal(validateDbUrl("file:./archive.sqlite", "sqlite"), "file:./archive.sqlite");
  assert.throws(() => validateDbUrl("mysql://u@h/db"), (e) => e.statusCode === 400);
  assert.throws(() => validateDbUrl(""), (e) => e.statusCode === 400);
});

run("mergeDbConfig folds url into existing config immutably", () => {
  const existing = { other: 1, database: { foo: "bar" } };
  const merged = mergeDbConfig(existing, { engine: "mysql", url: "mysql://u:p@h:3306/db" });
  assert.deepEqual(merged, { other: 1, database: { foo: "bar", engine: "mysql", url: "mysql://u:p@h:3306/db" } });
  assert.equal(existing.database.url, undefined); // original untouched
});

run("validate/merge FileStore config supports disk + Dropbox without leaking old token", () => {
  assert.deepEqual(validateFileStoreConfig({ kind: "disk", disk: { rootDir: " .files " } }),
    { kind: "disk", disk: { rootDir: ".files" } });
  assert.deepEqual(validateFileStoreConfig({ kind: "dropbox", dropbox: { accessToken: " token ", refreshToken: " refresh ", appKey: " app ", appSecret: " secret ", rootPath: " /archive ", selectUser: " dbid:user1 " } }),
    { kind: "dropbox", dropbox: { accessToken: "token", refreshToken: "refresh", appKey: "app", appSecret: "secret", rootPath: "/archive", selectUser: "dbid:user1" } });
  assert.deepEqual(validateFileStoreConfig({ kind: "s3", s3: { bucket: " media ", forcePathStyle: true } }),
    { kind: "s3", s3: { bucket: "media", forcePathStyle: true } });
  assert.throws(() => validateFileStoreConfig({ kind: "unknown" }), (e) => e.statusCode === 400);

  const existing = { fileStore: { dropbox: { accessToken: "old-token", refreshToken: "old-refresh", appSecret: "old-secret", rootPath: "/old" } } };
  const kept = mergeFileStoreConfig(existing, { kind: "dropbox", dropbox: { rootPath: "/new", appKey: "app" } });
  assert.equal(kept.fileStore.dropbox.accessToken, "old-token");
  assert.equal(kept.fileStore.dropbox.refreshToken, "old-refresh");
  assert.equal(kept.fileStore.dropbox.appSecret, "old-secret");
  assert.equal(kept.fileStore.dropbox.appKey, "app");
  assert.equal(kept.fileStore.dropbox.rootPath, "/new");
  const replaced = mergeFileStoreConfig(existing, { kind: "dropbox", dropbox: { accessToken: "new-token", refreshToken: "new-refresh", appSecret: "new-secret", rootPath: "/new" } });
  assert.equal(replaced.fileStore.dropbox.accessToken, "new-token");
  assert.equal(replaced.fileStore.dropbox.refreshToken, "new-refresh");
  assert.equal(replaced.fileStore.dropbox.appSecret, "new-secret");
});

await run("testPostgresConnection ok/failure via injected pg", async () => {
  const okPg = { Client: class { async connect() {} async query() {} async end() {} } };
  assert.deepEqual(await testPostgresConnection("postgresql://u:p@h/db", { pgModule: okPg }), { ok: true });
  const badPg = { Client: class { async connect() { throw new Error("ECONNREFUSED"); } async end() {} } };
  const r = await testPostgresConnection("postgresql://u:p@h/db", { pgModule: badPg });
  assert.equal(r.ok, false);
  assert.match(r.error, /ECONNREFUSED/);
});

await run("HTTP: admin endpoints — gate + test + persist", async () => {
  const SECRET = "adm";
  let saved = null;
    const server = createApiServer({
    backend: "test", authSecret: SECRET, rateLimit: null,
    resolveConfig: (opts) => resolveServerConfig({
      file: opts?.file || {
        database: { engine: "postgresql", url: "postgresql://archive:secret@postgres:5432/archive" },
        fileStore: { kind: "dropbox", dropbox: { accessToken: "hidden-token", refreshToken: "hidden-refresh", appKey: "app-key", appSecret: "hidden-secret", rootPath: "/media", selectUser: "dbid:user1" } }
      },
      env: opts?.env || {}
    }),
    loadConfigFile: () => ({}),
    saveConfig: (cfg) => { saved = cfg; return true; },
    testDbConnection: async (candidate) => ({ ok: true, echo: candidate })
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = signJwt({ sub: "u1", role: "admin" }, SECRET);
  const viewer = signJwt({ sub: "u2", role: "viewer" }, SECRET);
  try {
    // gate
    assert.equal((await fetch(`${base}/api/admin/config`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/config`, { headers: { Authorization: `Bearer ${viewer}` } })).status, 403);

    // GET config (admin) → masked bundled target
    const get = await fetch(`${base}/api/admin/config`, { headers: { Authorization: `Bearer ${admin}` } });
    assert.equal(get.status, 200);
    const view = (await get.json()).result;
    assert.equal(view.database.engine, "postgresql");
    assert.equal(view.database.url, "postgresql://archive:***@postgres:5432/archive");
    assert.equal(view.database.target, "bundled");
    assert.equal(view.fileStore.kind, "dropbox");
    assert.equal(view.fileStore.dropbox.rootPath, "/media");
    assert.equal(view.fileStore.dropbox.appKey, "app-key");
    assert.equal(view.fileStore.dropbox.selectUser, "dbid:user1");
    assert.equal(view.fileStore.dropbox.hasAccessToken, true);
    assert.equal(view.fileStore.dropbox.hasRefreshToken, true);
    assert.equal(view.fileStore.dropbox.hasAppSecret, true);
    assert.equal(JSON.stringify(view).includes("hidden-token"), false);
    assert.equal(JSON.stringify(view).includes("hidden-refresh"), false);
    assert.equal(JSON.stringify(view).includes("hidden-secret"), false);

    // test connection
    const test = await fetch(`${base}/api/admin/db/test`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify({ url: "postgresql://u:p@ext.example.com:5432/db" }) });
    const testResult = (await test.json()).result;
    assert.equal(testResult.ok, true);
    assert.equal(testResult.echo.engine, "postgresql");
    // invalid candidate → 400
    const bad = await fetch(`${base}/api/admin/db/test`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify({ url: "nope" }) });
    assert.equal(bad.status, 400);

    // persist external target
    const save = await fetch(`${base}/api/admin/config`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify({ database: { engine: "postgresql", url: "postgresql://u:p@ext.example.com:5432/prod" } }) });
    assert.equal(save.status, 200);
    const result = (await save.json()).result;
    assert.equal(result.saved, true);
    assert.equal(result.restartRequired, true);
    assert.equal(result.database.target, "external");
    assert.equal(saved.database.engine, "postgresql");
    assert.equal(saved.database.url, "postgresql://u:p@ext.example.com:5432/prod"); // saveConfig got the full url

    const saveFiles = await fetch(`${base}/api/admin/config`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify({ fileStore: { kind: "dropbox", dropbox: { accessToken: "new-dropbox-token", refreshToken: "new-refresh", appKey: "new-app", appSecret: "new-secret", rootPath: "/active", selectUser: "dbid:user2" } } }) });
    assert.equal(saveFiles.status, 200);
    const filesResult = (await saveFiles.json()).result;
    assert.equal(filesResult.saved, true);
    assert.equal(filesResult.restartRequired, true);
    assert.equal(filesResult.fileStore.kind, "dropbox");
    assert.equal(filesResult.fileStore.dropbox.rootPath, "/active");
    assert.equal(filesResult.fileStore.dropbox.appKey, "new-app");
    assert.equal(filesResult.fileStore.dropbox.selectUser, "dbid:user2");
    assert.equal(filesResult.fileStore.dropbox.hasAccessToken, true);
    assert.equal(filesResult.fileStore.dropbox.hasRefreshToken, true);
    assert.equal(filesResult.fileStore.dropbox.hasAppSecret, true);
    assert.equal(JSON.stringify(filesResult).includes("new-dropbox-token"), false);
    assert.equal(JSON.stringify(filesResult).includes("new-refresh"), false);
    assert.equal(JSON.stringify(filesResult).includes("new-secret"), false);
    assert.equal(saved.fileStore.kind, "dropbox");
    assert.equal(saved.fileStore.dropbox.accessToken, "new-dropbox-token");
    assert.equal(saved.fileStore.dropbox.refreshToken, "new-refresh");
    assert.equal(saved.fileStore.dropbox.appSecret, "new-secret");
    assert.equal(saved.fileStore.dropbox.selectUser, "dbid:user2");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll admin-config tests passed.");
});
