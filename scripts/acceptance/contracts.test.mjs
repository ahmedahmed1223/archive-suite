import assert from "node:assert/strict";
import test from "node:test";

import { validateResult, validateScenario } from "./contracts.mjs";
import { ACCEPTANCE_SCENARIOS, selectScenarios } from "./registry.mjs";

test("registry exposes the five mandatory smoke scenarios", () => {
  assert.deepEqual(ACCEPTANCE_SCENARIOS.map(({ id }) => id), [
    "V1-IA-PLAT-001",
    "V1-IA-ARCH-001",
    "V1-IA-ADMIN-001",
    "V1-IA-ADMIN-002",
    "V1-IA-MULTI-001",
  ]);
  assert.ok(ACCEPTANCE_SCENARIOS.every((item) => validateScenario(item).id === item.id));
  assert.equal(selectScenarios({ tag: "smoke" }).length, 5);
});

test("contracts reject invented states and unknown tags", () => {
  assert.throws(() => validateResult({ scenarioId: "V1-IA-PLAT-001", status: "ok" }), /status/);
  assert.throws(
    () => validateScenario({ id: "V1-IA-X-001", title: "x", tags: ["fast"], capabilities: [], loginSessions: 0 }),
    /tag/,
  );
});

test("selection rejects unknown scenario identifiers", () => {
  assert.throws(() => selectScenarios({ ids: ["V1-IA-NOPE-999"] }), /unknown scenario/i);
});
