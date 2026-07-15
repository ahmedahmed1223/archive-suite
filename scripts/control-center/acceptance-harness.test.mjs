import assert from "node:assert/strict";
import test from "node:test";

import { ACCEPTANCE_PLATFORMS, ACCEPTANCE_SCENARIOS, createAcceptanceHarness } from "./acceptance-harness.mjs";

const passingRunner = async ({ platform, scenario }) => ({ ok: true, cleanHost: true, artifactVersion: "1.0.0", evidence: `logs/${platform}/${scenario}.txt` });

test("the same scenario ids run on every release platform and every result is saved as an artifact", async () => {
  const saved = [];
  const harness = createAcceptanceHarness({ runScenario: passingRunner, saveArtifact: (record) => saved.push(record) });
  const outcome = await harness({ release: { version: "1.0.0" } });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.code, "ACCEPTANCE_MATRIX_PASSED");
  assert.equal(saved.length, ACCEPTANCE_PLATFORMS.length * ACCEPTANCE_SCENARIOS.length);
  for (const platform of ACCEPTANCE_PLATFORMS) {
    assert.deepEqual(saved.filter((record) => record.platform === platform).map((record) => record.scenario), [...ACCEPTANCE_SCENARIOS]);
  }
});

test("a failing or crashing scenario fails the matrix but the run still records its artifact", async () => {
  const saved = [];
  const harness = createAcceptanceHarness({
    runScenario: async ({ platform, scenario }) => {
      if (scenario === "security" && platform === "linux-native") throw new Error("runner died");
      return { ok: scenario !== "uninstall", cleanHost: true };
    },
    saveArtifact: (record) => saved.push(record),
  });
  const outcome = await harness();

  assert.equal(outcome.ok, false);
  assert.equal(outcome.code, "ACCEPTANCE_MATRIX_FAILED");
  assert.ok(outcome.details.failed.some(({ scenario, code }) => scenario === "security" && code === "SCENARIO_CRASHED"));
  assert.equal(saved.length, ACCEPTANCE_PLATFORMS.length * ACCEPTANCE_SCENARIOS.length);
});

test("an unsaveable artifact invalidates the whole run and unknown platforms are rejected", async () => {
  const harness = createAcceptanceHarness({ runScenario: passingRunner, saveArtifact: () => { throw new Error("disk full"); } });
  const outcome = await harness({ platforms: ["linux-native"] });
  assert.equal(outcome.code, "ACCEPTANCE_ARTIFACT_SAVE_FAILED");

  const unknown = await createAcceptanceHarness({ runScenario: passingRunner, saveArtifact: () => {} })({ platforms: ["macos"] });
  assert.equal(unknown.code, "ACCEPTANCE_PLATFORM_UNKNOWN");
});
