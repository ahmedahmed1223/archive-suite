import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGate, gatePlan, resolveGate } from "./gates.mjs";

test("V1-813 daily permits declared blocked capability but RC rejects it", () => {
  const daily = resolveGate("daily");
  const results = daily.scenarios.map(({ id }) => ({ scenarioId: id, status: id === "V1-IA-GATE-001" ? "blocked-capability" : "passed" }));
  assert.equal(evaluateGate({ name: "daily", results, availableCapabilities: ["docker"] }).passed, true);
  const rc = resolveGate("rc");
  assert.equal(evaluateGate({ name: "rc", results: rc.scenarios.map(({ id }) => ({ scenarioId: id, status: "blocked-capability" })), availableCapabilities: [] }).passed, false);
});
test("V1-810 and V1-812 are scheduled for nightly and release gates", () => {
  const nightlyIds = resolveGate("nightly").scenarios.map(({ id }) => id);
  assert.ok(nightlyIds.includes("V1-IA-MEDIA-001")); assert.ok(nightlyIds.includes("V1-IA-LOAD-001"));
  assert.deepEqual(gatePlan().map(({ name }) => name), ["daily", "nightly", "rc", "ga"]);
});
