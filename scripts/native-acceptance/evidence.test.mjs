import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writeAcceptanceEvidence } from "./evidence.mjs";

const validEvidence = (overrides = {}) => ({
  platform: "linux-native",
  runId: "native-20260808-001",
  commit: "a".repeat(40),
  version: "1.0.0",
  bundleDigest: "b".repeat(64),
  environment: { kind: "docker-systemd", operatingSystem: "Debian 12" },
  scenarios: [
    { id: "checksum", ok: true },
    { id: "install", ok: true },
    { id: "health", ok: true },
    { id: "uninstall", ok: true },
  ],
  cleanup: { ok: true, servicesAbsent: true, filesAbsent: true, dockerResourcesAbsent: true },
  createdAt: "2026-08-08T12:00:00.000Z",
  ...overrides,
});

test("evidence writer emits deterministic sanitized JSON only after cleanup passes", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "native-evidence-"));
  const path = writeAcceptanceEvidence(validEvidence(), { outputDir });
  const parsed = JSON.parse(readFileSync(path, "utf8"));

  assert.equal(parsed.schemaVersion, "1.0");
  assert.equal(parsed.platform, "linux-native");
  assert.deepEqual(parsed.cleanup, { ok: true, servicesAbsent: true, filesAbsent: true, dockerResourcesAbsent: true });
  assert.equal(Object.hasOwn(parsed, "password"), false);
});

test("evidence writer refuses failed cleanup and sensitive keys or credential URLs", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "native-evidence-invalid-"));
  assert.throws(() => writeAcceptanceEvidence(validEvidence({ cleanup: { ok: false } }), { outputDir }), /cleanup/i);
  assert.throws(() => writeAcceptanceEvidence(validEvidence({ environment: { password: "hidden" } }), { outputDir }), /sensitive/i);
  assert.throws(() => writeAcceptanceEvidence(validEvidence({ environment: { endpoint: "postgres://user:hidden@db/archive" } }), { outputDir }), /credential/i);
});
