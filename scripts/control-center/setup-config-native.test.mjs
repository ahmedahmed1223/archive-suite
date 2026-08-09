import assert from "node:assert/strict";
import test from "node:test";

import { createSetupConfiguration } from "./setup-config.mjs";
import { loadPlatformContract } from "../platform-contract.mjs";

const nativeConfig = (dataServices) => ({
  schemaVersion: "1.0",
  mode: "native",
  platform: "linux-native",
  source: "online",
  intent: "fresh",
  access: "local",
  runtimeProfiles: ["core"],
  capabilities: [],
  dataServices,
  storage: { driver: "local", path: "/srv/archive-suite/storage" },
});

test("native managed data normalizes without a credential-bearing endpoint", () => {
  const setup = createSetupConfiguration({ loadPlatformContract });
  const result = setup.importInput(nativeConfig({
    postgres: { enabled: true, kind: "managed" },
    redis: { enabled: true, kind: "managed" },
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.details.dataServices, {
    postgres: { enabled: true, kind: "managed" },
    redis: { enabled: true, kind: "managed" },
  });
});

test("native external data rejects credentials embedded in endpoint hosts", () => {
  const setup = createSetupConfiguration({ loadPlatformContract });
  const result = setup.importInput(nativeConfig({
    postgres: { enabled: true, kind: "external", host: "archive:secret@db.example.test", port: 5432, database: "archive" },
    redis: { enabled: true, kind: "external", host: "cache.example.test", port: 6379 },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.code, "CONFIG_INVALID");
});

test("native keeps PostgreSQL required while allowing the user to disable optional Redis", () => {
  const setup = createSetupConfiguration({ loadPlatformContract });
  const result = setup.importInput(nativeConfig({
    postgres: { enabled: true, kind: "managed" },
    redis: { enabled: false },
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.details.dataServices, {
    postgres: { enabled: true, kind: "managed" },
    redis: { enabled: false },
  });
});
