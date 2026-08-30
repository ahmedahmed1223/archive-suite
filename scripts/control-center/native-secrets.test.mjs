import assert from "node:assert/strict";
import test from "node:test";

import { createNativeSecretStore } from "./native-secrets.mjs";

test("native secret store persists generated values with platform protection and keeps manifest data value-free", () => {
  const writes = [];
  const protections = [];
  const store = createNativeSecretStore({
    platform: "linux-native",
    installRoot: "/opt/archive-suite",
    randomBytes: () => Buffer.alloc(32, 7),
    writeFile: (path, content, options) => writes.push({ path, content, options }),
    protect: (path) => { protections.push(path); return { status: 0 }; },
  });

  const secrets = store.create();

  assert.match(secrets.appKey, /^base64:/);
  assert.equal(secrets.dbOwnerPassword.length, 64);
  assert.equal(secrets.dbAppPassword.length, 64);
  assert.equal(secrets.redisPassword.length, 64);
  assert.deepEqual(store.manifestReference(secrets), { path: "/opt/archive-suite/config/secrets.env" });
  assert.equal(writes[0].path, "/opt/archive-suite/config/secrets.env");
  assert.equal(writes[0].options.mode, 0o600);
  assert.deepEqual(protections, ["/opt/archive-suite/config/secrets.env"]);
  assert.doesNotMatch(JSON.stringify(store.manifestReference(secrets)), /base64:|070707/);
});

test("native secret store reuses a valid existing file during repair instead of rotating database credentials", () => {
  const writes = [];
  const store = createNativeSecretStore({
    platform: "windows-native",
    installRoot: "C:\\ArchiveSuite",
    randomBytes: () => Buffer.alloc(32, 9),
    writeFile: (path, content, options) => writes.push({ path, content, options }),
    protect: () => ({ status: 0 }),
  });
  const first = store.create();
  const existing = `APP_KEY=${first.appKey}\nARCHIVE_DB_OWNER_PASSWORD=${first.dbOwnerPassword}\nARCHIVE_DB_APP_PASSWORD=${first.dbAppPassword}\nARCHIVE_REDIS_PASSWORD=${first.redisPassword}\n`;
  const repaired = createNativeSecretStore({
    platform: "windows-native",
    installRoot: "C:\\ArchiveSuite",
    writeFile: () => { throw new Error("repair must not write a new secret file"); },
    protect: () => ({ status: 0 }),
    exists: () => true,
    readFile: () => existing,
  });
  assert.deepEqual(first, {
    appKey: "base64:" + Buffer.alloc(32, 9).toString("base64"),
    dbOwnerPassword: Buffer.alloc(32, 9).toString("hex"),
    dbAppPassword: Buffer.alloc(32, 9).toString("hex"),
    redisPassword: Buffer.alloc(32, 9).toString("hex"),
  });
  assert.equal(writes.length, 1);
  assert.equal(existing.includes("ARCHIVE_REDIS_PASSWORD="), true);
  assert.deepEqual(repaired.ensure(), first);
});
