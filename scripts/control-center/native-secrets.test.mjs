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
