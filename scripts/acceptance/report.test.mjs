import assert from "node:assert/strict";
import test from "node:test";

import { buildAcceptanceReport, renderAcceptanceMarkdown } from "./report.mjs";

test("acceptance report compares runs and records blocked capabilities as release blockers", () => {
  const report = buildAcceptanceReport([
    { runId: "previous", status: "passed", provider: { name: "docker", capabilities: ["docker"] }, budget: { logins: 8, refreshes: 8 }, results: [{ scenarioId: "V1-IA-PLAT-001", status: "passed", attempts: 1 }] },
    { runId: "current", status: "blocked-capability", provider: { name: "windows-native", capabilities: [] }, budget: { logins: 0, refreshes: 0 }, results: [{ scenarioId: "V1-IA-LIFE-001", status: "blocked-capability", blockedCapabilities: ["windows-native"], attempts: 0 }] },
  ]);
  assert.equal(report.runs[1].releaseBlocking, true);
  assert.equal(report.comparison.regressions[0].scenarioId, "V1-IA-LIFE-001");
  assert.match(renderAcceptanceMarkdown(report), /Release blockers/);
});
