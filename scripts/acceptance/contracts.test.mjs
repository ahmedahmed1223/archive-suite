import assert from "node:assert/strict";
import test from "node:test";

import { FAILURE_CLASSIFICATIONS, SCENARIO_TAGS, validateResult, validateScenario } from "./contracts.mjs";
import { ACCEPTANCE_REGISTRY_VERSION, ACCEPTANCE_SCENARIOS, selectScenarios } from "./registry.mjs";

// The registry grows as later waves add daily/nightly/rc/ga/external and
// lifecycle scenarios, so this guard pins the thing that must NOT drift: the
// mandatory smoke set. Asserting the whole registry here would only need
// editing every time a scenario is added — that rubber-stamps additions
// instead of guarding them.
const MANDATORY_SMOKE_SCENARIOS = [
  "V1-IA-PLAT-001",
  "V1-IA-ARCH-001",
  "V1-IA-ADMIN-001",
  "V1-IA-ADMIN-002",
  "V1-IA-MULTI-001",
];

test("registry exposes the five mandatory smoke scenarios", () => {
  assert.match(ACCEPTANCE_REGISTRY_VERSION, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(selectScenarios({ tag: "smoke" }).map(({ id }) => id), MANDATORY_SMOKE_SCENARIOS);
  const registryIds = ACCEPTANCE_SCENARIOS.map(({ id }) => id);
  for (const id of MANDATORY_SMOKE_SCENARIOS) assert.ok(registryIds.includes(id), `${id} missing from registry`);
  assert.equal(new Set(registryIds).size, registryIds.length, "scenario ids must be unique");
  assert.ok(ACCEPTANCE_SCENARIOS.every((item) => validateScenario(item).id === item.id));
  assert.deepEqual(SCENARIO_TAGS, ["smoke", "daily", "nightly", "rc", "ga", "external"]);
});

test("contracts reject invented states and unknown tags", () => {
  assert.throws(() => validateResult({ scenarioId: "V1-IA-PLAT-001", status: "ok" }), /status/);
  assert.throws(
    () => validateScenario({ id: "V1-IA-X-001", title: "x", tags: ["fast"], capabilities: [], loginSessions: 0 }),
    /tag/,
  );
});

test("failed results require one of the diagnosis taxonomy classifications", () => {
  assert.deepEqual(FAILURE_CLASSIFICATIONS, ["product", "platform", "data", "environment", "flake"]);
  assert.throws(() => validateResult({ scenarioId: "V1-IA-PLAT-001", status: "failed" }), /classification/);
  assert.throws(() => validateResult({ scenarioId: "V1-IA-PLAT-001", status: "failed", classification: "unknown" }), /classification/);
  assert.throws(
    () => validateResult({ scenarioId: "V1-IA-PLAT-001", status: "failed", classification: "product" }),
    /reason/,
  );
});

test("selection rejects unknown scenario identifiers", () => {
  assert.throws(() => selectScenarios({ ids: ["V1-IA-NOPE-999"] }), /unknown scenario/i);
});

test("every registered tag resolves to scenarios that all carry it", () => {
  for (const tag of SCENARIO_TAGS) {
    const selected = selectScenarios({ tag });
    assert.ok(selected.every((item) => item.tags.includes(tag)), `${tag} selection returned a scenario without the tag`);
  }
  // "external" is now populated (V1-IA-EXT-*) — it was empty when this suite
  // was first written, so the old assertion pinned emptiness rather than the
  // selection contract it meant to cover.
  assert.ok(selectScenarios({ tag: "external" }).length > 0);
});
