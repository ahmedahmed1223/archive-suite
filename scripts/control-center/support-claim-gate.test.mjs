import assert from "node:assert/strict";
import test from "node:test";

import { ACCEPTANCE_SCENARIOS } from "./acceptance-harness.mjs";
import { evaluateSupportClaim } from "./support-claim-gate.mjs";

const release = { version: "1.0.0", signed: true };
const fullMatrix = (platform, overrides = {}) => ACCEPTANCE_SCENARIOS.map((scenario) => ({ platform, scenario, ok: true, cleanHost: true, artifactVersion: "1.0.0", ...overrides }));

test("a complete clean-host matrix from the final signed artifact approves the claim", () => {
  const verdict = evaluateSupportClaim({ platform: "linux-native", currentStatus: "planned", release, results: fullMatrix("linux-native") });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.code, "SUPPORT_CLAIM_APPROVED");
});

test("prerelease or unsigned artifacts can never back a support claim", () => {
  assert.equal(evaluateSupportClaim({ platform: "linux-native", currentStatus: "planned", release: { version: "1.0.0-rc.1", signed: true }, results: fullMatrix("linux-native") }).code, "SUPPORT_RELEASE_NOT_FINAL");
  assert.equal(evaluateSupportClaim({ platform: "linux-native", currentStatus: "planned", release: { version: "1.0.0", signed: false }, results: fullMatrix("linux-native") }).code, "SUPPORT_RELEASE_NOT_FINAL");
});

test("missing or failing scenarios block the transition with the exact gaps listed", () => {
  const incomplete = fullMatrix("windows-native").filter((record) => record.scenario !== "security");
  const missing = evaluateSupportClaim({ platform: "windows-native", currentStatus: "planned", release, results: incomplete });
  assert.equal(missing.code, "SUPPORT_MATRIX_INCOMPLETE");
  assert.deepEqual(missing.details.missing, ["security"]);

  const failing = fullMatrix("windows-native").map((record) => (record.scenario === "data" ? { ...record, ok: false } : record));
  assert.equal(evaluateSupportClaim({ platform: "windows-native", currentStatus: "planned", release, results: failing }).code, "SUPPORT_MATRIX_FAILED");
});

test("dirty hosts or evidence from another version block the transition", () => {
  const dirty = fullMatrix("windows-10-11-docker").map((record) => (record.scenario === "install" ? { ...record, cleanHost: false } : record));
  assert.equal(evaluateSupportClaim({ platform: "windows-10-11-docker", currentStatus: "conditional", release, results: dirty }).code, "SUPPORT_EVIDENCE_MISMATCH");

  const stale = fullMatrix("windows-10-11-docker").map((record) => (record.scenario === "release" ? { ...record, artifactVersion: "0.9.0" } : record));
  assert.equal(evaluateSupportClaim({ platform: "windows-10-11-docker", currentStatus: "conditional", release, results: stale }).code, "SUPPORT_EVIDENCE_MISMATCH");
});

test("only planned or conditional platforms may transition, and only contract platforms at all", () => {
  assert.equal(evaluateSupportClaim({ platform: "linux-docker", currentStatus: "supported", release, results: fullMatrix("linux-docker") }).code, "SUPPORT_STATUS_INVALID");
  assert.equal(evaluateSupportClaim({ platform: "macos", currentStatus: "planned", release, results: [] }).code, "SUPPORT_PLATFORM_UNKNOWN");
});
