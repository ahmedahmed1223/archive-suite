import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  resolveDatabaseUrl, classifyDatabaseTarget, resolveFileStoreConfig, resolveServerConfig,
  loadServerConfigFile, saveServerConfigFile
} from "../src/config/serverConfig.js";

// Server-config layer: precedence (file > env > POSTGRES_* default), target
// classification, and the file load/save round-trip. Pure logic + a temp file.

let failures = 0;
function run(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (err) { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); }
}

run("resolveDatabaseUrl precedence: file > env DATABASE_URL > POSTGRES_* > none", () => {
  const file = { database: { url: "postgresql://u:p@ext.example.com:5432/db" } };
  assert.deepEqual(resolveDatabaseUrl({ file, env: { DATABASE_URL: "postgresql://x@postgres/archive" } }),
    { url: "postgresql://u:p@ext.example.com:5432/db", engine: "postgresql", source: "file" });

  assert.deepEqual(resolveDatabaseUrl({ file: {}, env: { DATABASE_URL: "postgresql://x:y@postgres:5432/archive" } }),
    { url: "postgresql://x:y@postgres:5432/archive", engine: "postgresql", source: "env" });

  const built = resolveDatabaseUrl({ file: {}, env: { POSTGRES_USER: "archive", POSTGRES_PASSWORD: "pw", POSTGRES_DB: "archive" } });
  assert.equal(built.source, "default");
  assert.equal(built.engine, "postgresql");
  assert.match(built.url, /^postgresql:\/\/archive:pw@postgres:5432\/archive$/);

  assert.deepEqual(resolveDatabaseUrl({ file: {}, env: {} }), { url: "", engine: "postgresql", source: "none" });
});

run("classifyDatabaseTarget distinguishes bundled vs external", () => {
  assert.equal(classifyDatabaseTarget("postgresql://u:p@postgres:5432/db"), "bundled");
  assert.equal(classifyDatabaseTarget("postgresql://u:p@127.0.0.1:5432/db"), "bundled");
  assert.equal(classifyDatabaseTarget("postgresql://u:p@db.supabase.co:5432/db"), "external");
  assert.equal(classifyDatabaseTarget("file:./archive.sqlite", "sqlite"), "file");
  assert.equal(classifyDatabaseTarget("nope"), "unknown");
});

run("resolveServerConfig surfaces url + source + target", () => {
  const cfg = resolveServerConfig({ file: {}, env: { DATABASE_URL: "postgresql://u:p@aws.rds.amazonaws.com:5432/prod" } });
  assert.equal(cfg.databaseEngine, "postgresql");
  assert.equal(cfg.databaseSource, "env");
  assert.equal(cfg.databaseTarget, "external");
  assert.match(cfg.databaseUrl, /aws\.rds/);
});

run("resolveFileStoreConfig precedence: file > env > disk default", () => {
  const file = { fileStore: { kind: "dropbox", dropbox: { accessToken: "file-token", refreshToken: "file-refresh", appKey: "file-app", appSecret: "file-secret", rootPath: "/archive", selectUser: "dbid:file-user" } } };
  const env = { FILE_STORE: "disk", DROPBOX_ACCESS_TOKEN: "env-token", DROPBOX_REFRESH_TOKEN: "env-refresh", DROPBOX_APP_KEY: "env-app", DROPBOX_APP_SECRET: "env-secret", DROPBOX_ROOT_PATH: "/env", DROPBOX_SELECT_USER: "dbid:env-user", FILE_STORE_DIR: ".files" };
  assert.deepEqual(resolveFileStoreConfig({ file, env }), {
    fileStore: "dropbox",
    fileStoreSource: "file",
    fileStoreDir: ".files",
    dropboxAccessToken: "file-token",
    dropboxAccessTokenExpiresAt: undefined,
    dropboxRefreshToken: "file-refresh",
    dropboxAppKey: "file-app",
    dropboxAppSecret: "file-secret",
    dropboxRootPath: "/archive",
    dropboxSelectUser: "dbid:file-user",
    dropboxSelectAdmin: undefined
  });

  assert.deepEqual(resolveFileStoreConfig({ file: {}, env }), {
    fileStore: "disk",
    fileStoreSource: "env",
    fileStoreDir: ".files",
    dropboxAccessToken: "env-token",
    dropboxAccessTokenExpiresAt: undefined,
    dropboxRefreshToken: "env-refresh",
    dropboxAppKey: "env-app",
    dropboxAppSecret: "env-secret",
    dropboxRootPath: "/env",
    dropboxSelectUser: "dbid:env-user",
    dropboxSelectAdmin: undefined
  });

  assert.equal(resolveFileStoreConfig({ file: {}, env: {} }).fileStore, "disk");
  assert.equal(resolveFileStoreConfig({ file: {}, env: {} }).fileStoreSource, "default");
});

run("load/save server config file round-trips; missing → {}", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srvcfg-"));
  const file = path.join(dir, "nested", "server-config.json");
  assert.deepEqual(loadServerConfigFile(file), {}); // missing
  saveServerConfigFile({ database: { url: "postgresql://u:p@h:5432/db" } }, file);
  assert.equal(loadServerConfigFile(file).database.url, "postgresql://u:p@h:5432/db");
  // resolve through the saved file
  const cfg = resolveServerConfig({ file: loadServerConfigFile(file), env: {} });
  assert.equal(cfg.databaseSource, "file");
  fs.rmSync(dir, { recursive: true, force: true });
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll server-config tests passed.");
});
