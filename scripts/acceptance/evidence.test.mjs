import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertNoSensitiveEvidence, createEvidenceStore } from "./evidence.mjs";

test("evidence is redacted and manifest is written outside the repository", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-acceptance-"));
  const store = createEvidenceStore({
    root,
    runId: "run-001",
    now: new Date("2026-07-19T00:00:00Z"),
    secure: () => {}, secureDirectory: () => {},
  });
  store.writeArtifact("probe.json", { token: "secret-value", url: "postgres://u:p@db/archive" });
  const manifest = store.finalize({ status: "passed", results: [] });
  assert.equal(manifest.status, "passed");
  assert.doesNotMatch(readFileSync(join(root, "run-001", "probe.json"), "utf8"), /secret-value|u:p/);
});

test("leak scanner rejects a credential missed by sanitization", () => {
  assert.throws(() => assertNoSensitiveEvidence("Authorization: Bearer abc.def.ghi"), /sensitive evidence/i);
});

test("leak scanner rejects credentials embedded in a URL query", () => {
  assert.throws(
    () => assertNoSensitiveEvidence("https://archive.example.test/export?access_token=raw-token"),
    /sensitive evidence/i,
  );
});

test("artifact names cannot escape the run directory", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-acceptance-"));
  const store = createEvidenceStore({ root, runId: "run-002", secure: () => {}, secureDirectory: () => {} });
  assert.throws(() => store.writeArtifact("../outside.json", {}), /artifact name/i);
});

test("evidence roots inside the source tree are rejected before an artifact is written", () => {
  const sourceRoot = mkdtempSync(join(tmpdir(), "archive-source-"));
  assert.throws(
    () => createEvidenceStore({ root: join(sourceRoot, "artifacts"), runId: "run-003", sourceRoot, secure: () => {}, secureDirectory: () => {} }),
    /outside the source tree/i,
  );
});

test("finalization writes deterministic summary and manifest evidence with owner-only permissions", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-acceptance-"));
  const secured = [];
  const store = createEvidenceStore({
    root,
    runId: "run-004",
    now: new Date("2026-07-19T00:00:00Z"),
    secure: (path) => secured.push(path), secureDirectory: () => {},
  });
  const input = {
    status: "passed",
    exitCode: 0,
    results: [{ scenarioId: "V1-IA-ARCH-001", status: "passed", attempts: 1 }],
  };
  const manifest = store.finalize(input);
  const directory = join(root, "run-004");
  assert.deepEqual(JSON.parse(readFileSync(join(directory, "summary.json"), "utf8")), manifest);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")), manifest);
  assert.deepEqual(secured.sort(), [join(directory, "manifest.json"), join(directory, "summary.json")].sort());
  if (process.platform !== "win32") {
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.equal(statSync(join(directory, "manifest.json")).mode & 0o777, 0o600);
  }
});

test("finalization fails when a pre-existing log artifact retains a credential URL or user path", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-acceptance-"));
  const store = createEvidenceStore({ root, runId: "run-005", secure: () => {}, secureDirectory: () => {} });
  const logs = join(root, "run-005", "logs");
  mkdirSync(logs, { recursive: true });
  writeFileSync(join(logs, "server.log"), "postgres://operator:topsecret@example.test/archive\nC:\\Users\\operator\\private.log");
  assert.throws(
    () => store.finalize({ status: "failed", results: [] }),
    /sensitive evidence/i,
  );
});
