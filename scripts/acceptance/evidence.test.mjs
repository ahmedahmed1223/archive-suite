import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
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
    secure: () => {},
  });
  store.writeArtifact("probe.json", { token: "secret-value", url: "postgres://u:p@db/archive" });
  const manifest = store.finalize({ status: "passed", results: [] });
  assert.equal(manifest.status, "passed");
  assert.doesNotMatch(readFileSync(join(root, "run-001", "probe.json"), "utf8"), /secret-value|u:p/);
});

test("leak scanner rejects a credential missed by sanitization", () => {
  assert.throws(() => assertNoSensitiveEvidence("Authorization: Bearer abc.def.ghi"), /sensitive evidence/i);
});

test("artifact names cannot escape the run directory", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-acceptance-"));
  const store = createEvidenceStore({ root, runId: "run-002", secure: () => {} });
  assert.throws(() => store.writeArtifact("../outside.json", {}), /artifact name/i);
});
