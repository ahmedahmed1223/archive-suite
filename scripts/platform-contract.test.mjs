import assert from "node:assert/strict";
import test from "node:test";

import {
  loadPlatformContract,
  resolveComposeProfiles,
  selectPlatforms,
  validateRuntimeOptionSources,
} from "./platform-contract.mjs";

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
  assert.deepEqual(Object.keys(contract.runtimeProfiles), ["core", "media", "edge"]);
  assert.deepEqual(Object.keys(contract.capabilities), ["ocr", "ai", "observability"]);
  for (const platform of contract.platforms) {
    assert.deepEqual(platform.profiles, ["core", "media", "edge"]);
    assert.deepEqual(platform.capabilities, ["ocr", "ai", "observability"]);
  }
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

test("runtime option gate rejects profile drift and never enables capabilities", () => {
  const contract = loadPlatformContract();
  const setupSource = "resolveComposeProfiles(contract, configuredProfiles)";

  assert.deepEqual(resolveComposeProfiles(contract, undefined), []);
  assert.deepEqual(resolveComposeProfiles(contract, "media,edge"), ["media", "edge"]);
  assert.deepEqual(resolveComposeProfiles(contract, ""), []);
  assert.throws(() => resolveComposeProfiles(contract, "media,ocr"), /capabilit/i);
  assert.throws(
    () => validateRuntimeOptionSources(contract, {
      composeSource: 'profiles: ["media", "ocr"]',
      setupSource,
    }),
    /Docker Compose runtime profiles/i
  );
  assert.throws(
    () => validateRuntimeOptionSources(contract, {
      composeSource: 'profiles: ["media", "edge"]',
      setupSource: "const profiles = [\"media\", \"ocr\"]",
    }),
    /Control Center/i
  );
});
