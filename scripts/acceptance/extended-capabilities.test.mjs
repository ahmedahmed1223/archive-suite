import assert from "node:assert/strict";
import test from "node:test";
import { discoverExtendedCapabilities, evidenceTemplate } from "./extended-capabilities.mjs";

test("extended capability discovery is blocked without external prerequisites and never emits secrets", () => {
  const discovery = discoverExtendedCapabilities({ OPENAI_API_KEY: "secret-value", ODBC_PASSWORD: "secret-value" }, { platform: "linux", commandExists: () => false });
  assert.equal(discovery.length, 4);
  assert.ok(discovery.every((item) => item.status === "blocked-capability"));
  assert.doesNotMatch(JSON.stringify(discovery), /secret-value/);
});

test("evidence template begins not-executed even if discovery is ready", () => {
  const template = evidenceTemplate([{ id: "V1-X01", status: "ready-for-live-validation" }], { sourceCommit: "a".repeat(40), appVersion: "1.0.0" });
  assert.equal(template.status, "not-executed");
  assert.ok(template.runs.every((item) => item.status === "not-executed"));
});
