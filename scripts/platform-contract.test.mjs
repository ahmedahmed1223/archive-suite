import assert from "node:assert/strict";
import test from "node:test";

import { loadPlatformContract, selectPlatforms } from "./platform-contract.mjs";

test("platform contract loads the four constrained deployment targets", () => {
  const contract = loadPlatformContract();

  assert.equal(contract.schemaVersion, "1.0");
  assert.deepEqual(
    contract.platforms.map((platform) => platform.id),
    ["windows-10-11-docker", "linux-docker", "windows-native", "linux-native"]
  );
  assert.deepEqual(
    contract.platforms.map((platform) => platform.status),
    ["conditional", "conditional", "planned", "planned"]
  );
  assert.deepEqual(Object.keys(contract.profiles), ["core", "media", "ocr", "ai", "observability"]);
  assert.ok(contract.ports.some((port) => port.exposure === "public"));
  assert.ok(contract.ports.some((port) => port.exposure === "internal"));
  assert.ok(contract.dataPaths.windows.root);
  assert.ok(contract.dataPaths.linux.root);
});

test("platform selection filters by mode or exact platform id", () => {
  const contract = loadPlatformContract();

  assert.deepEqual(
    selectPlatforms(contract, { mode: "docker" }).map((platform) => platform.id),
    ["windows-10-11-docker", "linux-docker"]
  );
  assert.deepEqual(
    selectPlatforms(contract, { platformId: "linux-native" }).map((platform) => platform.id),
    ["linux-native"]
  );
  assert.throws(() => selectPlatforms(contract, { mode: "unsupported" }), /mode/i);
  assert.throws(() => selectPlatforms(contract, { platformId: "unknown" }), /platform/i);
});
