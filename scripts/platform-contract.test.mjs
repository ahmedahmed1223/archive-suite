import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  loadPlatformContract,
  requiredDiskBytes,
  resolveComposeProfiles,
  SCHEMA_PATH,
  selectPlatforms,
  validateRuntimeOptionSources,
} from "./platform-contract.mjs";

const GIB = 1024 ** 3;

test("every resource profile declares machine-readable diskBytes matching its prose", () => {
  const contract = loadPlatformContract();
  for (const [id, value] of Object.entries(contract.resources)) {
    if (id === "status") continue;
    assert.ok(Number.isInteger(value.diskBytes), `resources.${id}.diskBytes must be an integer`);
    // The prose string stays for humans; diskBytes must not drift from it.
    const gib = Number(/(\d+)\s*GiB/.exec(value.disk)?.[1]);
    assert.equal(value.diskBytes, gib * GIB, `resources.${id}.diskBytes must equal the GiB stated in resources.${id}.disk`);
  }
});

test("required disk is the largest selected profile, not the sum", () => {
  const contract = loadPlatformContract();
  // core=100GiB and media=250GiB are each a total-host recommendation, so
  // running both needs 250GiB, not 350GiB.
  assert.equal(requiredDiskBytes(contract, { runtimeProfiles: ["core", "media"] }), 250 * GIB);
  assert.equal(requiredDiskBytes(contract, { runtimeProfiles: ["core"] }), 100 * GIB);
});

test("required disk covers capabilities as well as runtime profiles", () => {
  const contract = loadPlatformContract();
  // ai declares the largest footprint of all, so it must dominate core.
  assert.equal(requiredDiskBytes(contract, { runtimeProfiles: ["core"], capabilities: ["ai"] }), 500 * GIB);
});

test("required disk always includes core even when it is not passed explicitly", () => {
  const contract = loadPlatformContract();
  // core is implicit in the setup contract; an empty selection must never
  // resolve to a zero-byte requirement that lets any disk pass.
  assert.equal(requiredDiskBytes(contract, {}), 100 * GIB);
});

test("required disk rejects an unknown profile instead of silently ignoring it", () => {
  const contract = loadPlatformContract();
  assert.throws(() => requiredDiskBytes(contract, { runtimeProfiles: ["core", "nope"] }), /nope/);
});

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

test("platform schema permits only the legal runtime profile and capability keys", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const runtimeProfiles = schema.properties.runtimeProfiles;
  const capabilities = schema.properties.capabilities;

  assert.deepEqual(Object.keys(runtimeProfiles.properties), ["core", "media", "edge"]);
  assert.equal(runtimeProfiles.additionalProperties, false);
  assert.deepEqual(Object.keys(capabilities.properties), ["ocr", "ai", "observability"]);
  assert.equal(capabilities.additionalProperties, false);
});

test("runtime option gate rejects profile drift and never enables capabilities", () => {
  const contract = loadPlatformContract();

  assert.deepEqual(resolveComposeProfiles(contract, undefined), []);
  assert.deepEqual(resolveComposeProfiles(contract, "media,edge"), ["media", "edge"]);
  assert.deepEqual(resolveComposeProfiles(contract, ""), []);
  assert.throws(() => resolveComposeProfiles(contract, "media,ocr"), /capabilit/i);
  assert.throws(
    () => validateRuntimeOptionSources(contract, {
      composeSource: 'profiles: ["media", "ocr"]',
    }),
    /Docker Compose runtime profiles/i
  );
});
