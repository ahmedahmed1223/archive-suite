import assert from "node:assert/strict";
import test from "node:test";

import { parseAcceptanceArguments } from "../acceptance.mjs";
import { calculateAuthBudget, runAcceptance } from "./runner.mjs";

const scenario = Object.freeze({
  id: "V1-IA-ARCH-001",
  title: "Editor opens an archive record",
  tags: ["smoke"],
  capabilities: ["docker"],
  loginSessions: 1,
});

function providerFake(overrides = {}) {
  return {
    capabilities: ["docker"],
    prepare: async () => {},
    install: async () => {},
    start: async () => {},
    destroy: async () => ({ proved: true }),
    ...overrides,
  };
}

test("runner rejects a login budget above the server contract before prepare", async () => {
  let prepared = false;
  await assert.rejects(
    () => runAcceptance({
      scenarios: [{ id: "V1-IA-MULTI-001", loginSessions: 31, tags: ["smoke"], capabilities: ["docker"] }],
      provider: { prepare: async () => { prepared = true; } },
    }),
    /30 logins/,
  );
  assert.equal(prepared, false);
});

test("auth budget counts one refresh for each requested live login", () => {
  assert.deepEqual(calculateAuthBudget([{ loginSessions: 2 }, { loginSessions: 3 }]), {
    logins: 5,
    refreshes: 5,
  });
});

test("runner executes scenarios sequentially and retries only a flake once", async () => {
  const calls = [];
  let flakyAttempts = 0;
  const secondScenario = { ...scenario, id: "V1-IA-ADMIN-001", loginSessions: 1 };
  const result = await runAcceptance({
    scenarios: [scenario, secondScenario],
    provider: providerFake({
      prepare: async () => calls.push("prepare"),
      install: async () => calls.push("install"),
      start: async () => calls.push("start"),
      destroy: async () => { calls.push("destroy"); return { proved: true }; },
    }),
    executeScenario: async ({ scenario: current, attempt }) => {
      calls.push(`${current.id}:${attempt}`);
      if (current.id === scenario.id && ++flakyAttempts === 1) {
        return { scenarioId: current.id, status: "failed", classification: "flake" };
      }
      return { scenarioId: current.id, status: "passed", classification: "product" };
    },
  });

  assert.deepEqual(calls, [
    "prepare", "install", "start",
    "V1-IA-ARCH-001:1", "V1-IA-ARCH-001:2", "V1-IA-ADMIN-001:1",
    "destroy",
  ]);
  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
  assert.equal(result.results[0].attempts, 2);
});

test("runner destroys its environment after a product failure without retrying it", async () => {
  let destroyed = false;
  let attempts = 0;
  const result = await runAcceptance({
    scenarios: [scenario],
    provider: providerFake({ destroy: async () => { destroyed = true; return { proved: true }; } }),
    executeScenario: async () => {
      attempts += 1;
      return { scenarioId: scenario.id, status: "failed", classification: "product" };
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.equal(attempts, 1);
  assert.equal(destroyed, true);
});

test("runner records retained diagnostics when cleanup is explicitly kept", async () => {
  const artifacts = [];
  let destroyed = false;
  const result = await runAcceptance({
    scenarios: [scenario],
    keepEnvironment: true,
    provider: providerFake({ destroy: async () => { destroyed = true; } }),
    evidenceStore: {
      writeArtifact: (name, value) => artifacts.push([name, value]),
      finalize: (value) => value,
    },
    executeScenario: async () => ({ scenarioId: scenario.id, status: "passed" }),
  });
  assert.equal(destroyed, false);
  assert.deepEqual(result.cleanup, { keptForDiagnostics: true, proved: false });
  assert.deepEqual(artifacts, [["cleanup.json", { keptForDiagnostics: true, proved: false }]]);
});

test("an unproved required cleanup fails an otherwise passing run", async () => {
  const result = await runAcceptance({
    scenarios: [scenario],
    provider: providerFake({ destroy: async () => { throw new Error("Docker cleanup failed"); } }),
    executeScenario: async () => ({ scenarioId: scenario.id, status: "passed" }),
  });
  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.cleanup, { keptForDiagnostics: false, proved: false });
});

test("a provider startup failure records remaining selected scenarios as skipped", async () => {
  const secondScenario = { ...scenario, id: "V1-IA-ADMIN-001" };
  const result = await runAcceptance({
    scenarios: [scenario, secondScenario],
    provider: providerFake({
      prepare: async () => { throw new Error("Docker is unavailable"); },
      destroy: async () => ({ proved: true }),
    }),
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.results, [
    { scenarioId: scenario.id, status: "failed", classification: "product", attempts: 1 },
    { scenarioId: secondScenario.id, status: "skipped", attempts: 0 },
  ]);
});

test("unavailable capabilities are blocked and have deterministic exit code two", async () => {
  const result = await runAcceptance({
    scenarios: [scenario],
    provider: providerFake({ capabilities: [] }),
    executeScenario: async () => assert.fail("blocked scenario must not execute"),
  });
  assert.equal(result.status, "blocked-capability");
  assert.equal(result.exitCode, 2);
  assert.deepEqual(result.results, [{ scenarioId: scenario.id, status: "blocked-capability", attempts: 0 }]);
});

test("CLI accepts tag, repeated ids, and last-failed selection without ambiguous input", () => {
  assert.deepEqual(parseAcceptanceArguments(["run", "--tag", "smoke"]), {
    command: "run",
    tag: "smoke",
    ids: [],
    lastFailed: false,
    keepEnvironment: false,
  });
  assert.deepEqual(parseAcceptanceArguments(["run", "--id", "V1-IA-ARCH-001", "--id", "V1-IA-ADMIN-001", "--last-failed"]), {
    command: "run",
    tag: undefined,
    ids: ["V1-IA-ARCH-001", "V1-IA-ADMIN-001"],
    lastFailed: true,
    keepEnvironment: false,
  });
  assert.throws(() => parseAcceptanceArguments(["run", "--tag"]), /requires a value/i);
  assert.throws(() => parseAcceptanceArguments(["list"]), /usage/i);
});
