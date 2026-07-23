import assert from "node:assert/strict";
import test from "node:test";

import { main, parseAcceptanceArguments, resolveRunMetadata } from "../acceptance.mjs";
import { calculateAuthBudget, runAcceptance } from "./runner.mjs";

const scenario = Object.freeze({
  id: "V1-IA-ARCH-001",
  title: "Editor opens an archive record",
  tags: ["smoke"],
  capabilities: ["docker"],
  loginSessions: 1,
  timeoutMs: 1_000,
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

test("auth budget honors each scenario's declared refresh demand", () => {
  assert.deepEqual(calculateAuthBudget([{ loginSessions: 2, refreshSessions: 5 }]), {
    logins: 2,
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
  assert.deepEqual(result.results[0].attemptResults, [
    { attempt: 1, status: "failed", classification: "flake", reason: "scenario-failed" },
    { attempt: 2, status: "passed", classification: "product" },
  ]);
});

test("runner aborts a scenario at its declared deadline and still destroys the provider", async () => {
  const timers = [];
  let aborted = false;
  let destroyed = false;
  const run = runAcceptance({
    scenarios: [scenario],
    provider: providerFake({ destroy: async () => { destroyed = true; return { proved: true }; } }),
    executeScenario: async ({ signal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        resolve({ scenarioId: scenario.id, status: "passed" });
      }, { once: true });
    }),
    setTimer: (callback, milliseconds) => {
      const timer = { callback, milliseconds };
      timers.push(timer);
      return timer;
    },
    clearTimer: () => {},
  });
  while (!timers.some(({ milliseconds }) => milliseconds === scenario.timeoutMs)) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  timers.find(({ milliseconds }) => milliseconds === scenario.timeoutMs).callback();
  const result = await run;
  assert.equal(aborted, true);
  assert.equal(destroyed, true);
  assert.equal(result.results[0].classification, "environment");
  assert.equal(result.results[0].reason, "scenario-timeout");
});

test("runner enforces the collective fifteen-minute deadline with an injected clock", async () => {
  const timers = [];
  let destroyed = false;
  const run = runAcceptance({
    scenarios: [{ ...scenario, timeoutMs: 20 * 60_000 }],
    provider: providerFake({ destroy: async () => { destroyed = true; return { proved: true }; } }),
    executeScenario: async ({ signal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve({ scenarioId: scenario.id, status: "passed" }), { once: true });
    }),
    setTimer: (callback, milliseconds) => {
      const timer = { callback, milliseconds };
      timers.push(timer);
      return timer;
    },
    clearTimer: () => {},
  });
  await Promise.resolve();
  timers.find(({ milliseconds }) => milliseconds === 15 * 60_000).callback();
  const result = await run;
  assert.equal(destroyed, true);
  assert.equal(result.results[0].reason, "run-timeout");
  assert.equal(result.exitCode, 1);
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

test("a provider startup failure records every runnable scenario as a decisive platform failure", async () => {
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
    {
      scenarioId: scenario.id,
      status: "failed",
      classification: "platform",
      reason: "provider-failure",
      detail: "Docker is unavailable",
      attempts: 0,
      attemptResults: [],
    },
    {
      scenarioId: secondScenario.id,
      status: "failed",
      classification: "platform",
      reason: "provider-failure",
      detail: "Docker is unavailable",
      attempts: 0,
      attemptResults: [],
    },
  ]);
});

test("runner keeps the taxonomy classification for product, platform, data, and environment failures", async () => {
  const classifications = ["product", "platform", "data", "environment"];
  const scenarios = classifications.map((classification, index) => ({
    ...scenario,
    id: `V1-IA-ARCH-00${index + 1}`,
  }));
  const result = await runAcceptance({
    scenarios,
    provider: providerFake(),
    executeScenario: async ({ scenario: current }) => ({
      scenarioId: current.id,
      status: "failed",
      classification: classifications[scenarios.indexOf(current)],
    }),
  });
  assert.deepEqual(result.results.map((item) => item.classification), classifications);
  assert.ok(result.results.every((item) => item.attempts === 1));
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

test("tag-only CLI selection executes every matching registry scenario", async () => {
  const options = parseAcceptanceArguments(["run", "--tag", "smoke"]);
  const executed = [];
  const result = await runAcceptance({
    ...options,
    provider: providerFake(),
    executeScenario: async ({ scenario: current }) => {
      executed.push(current.id);
      return { scenarioId: current.id, status: "passed" };
    },
  });
  assert.equal(result.selected.length, 5);
  assert.equal(executed.length, 5);
  assert.equal(result.exitCode, 0);
});

test("runner passes the complete selected scenario id set to every execution attempt", async () => {
  const secondScenario = { ...scenario, id: "V1-IA-ADMIN-001" };
  const selections = [];
  await runAcceptance({
    scenarios: [scenario, secondScenario],
    provider: providerFake(),
    executeScenario: async ({ scenario: current, selectedScenarioIds }) => {
      selections.push([current.id, selectedScenarioIds]);
      return { scenarioId: current.id, status: "passed" };
    },
  });
  assert.deepEqual(selections, [
    [scenario.id, [scenario.id, secondScenario.id]],
    [secondScenario.id, [scenario.id, secondScenario.id]],
  ]);
});

test("legal smoke CLI uses the registered scenario executor when none is injected", async () => {
  const executed = [];
  const exitCode = await main(["run", "--tag", "smoke"], {
    createProvider: () => providerFake(),
    createStore: () => ({ directory: "test-evidence", writeArtifact: () => {}, finalize: () => {} }),
    createScenarioExecutor: () => async ({ scenario: current }) => {
      executed.push(current.id);
      return { scenarioId: current.id, status: "passed" };
    },
  });
  assert.equal(exitCode, 0);
  assert.equal(executed.length, 5);
});

test("last-failed reruns only failed scenario ids from the previous manifest", async () => {
  const secondScenario = { ...scenario, id: "V1-IA-ADMIN-001" };
  const executed = [];
  const result = await runAcceptance({
    scenarios: [scenario, secondScenario],
    lastFailed: { results: [
      { scenarioId: scenario.id, status: "passed" },
      { scenarioId: secondScenario.id, status: "failed", classification: "data" },
    ] },
    provider: providerFake(),
    executeScenario: async ({ scenario: current }) => {
      executed.push(current.id);
      return { scenarioId: current.id, status: "passed" };
    },
  });
  assert.deepEqual(executed, [secondScenario.id]);
  assert.deepEqual(result.selected, [secondScenario.id]);
});

test("runner rejects an empty selection instead of reporting a passing run", async () => {
  await assert.rejects(
    () => runAcceptance({ scenarios: [], provider: providerFake() }),
    /no acceptance scenarios selected/i,
  );
});

test("evidence failures try to finalize an error manifest without masking the original error", async () => {
  const finalized = [];
  await assert.rejects(
    () => runAcceptance({
      scenarios: [scenario],
      provider: providerFake(),
      evidenceStore: {
        writeArtifact: () => { throw new Error("cleanup artifact unavailable"); },
        finalize: (value) => finalized.push(value),
      },
      executeScenario: async () => ({ scenarioId: scenario.id, status: "passed" }),
    }),
    /cleanup artifact unavailable/,
  );
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].status, "failed");
  assert.equal(finalized[0].exitCode, 1);
});

test("manifest finalization failure records fallback error evidence and preserves that failure", async () => {
  const artifacts = [];
  await assert.rejects(
    () => runAcceptance({
      scenarios: [scenario],
      provider: providerFake(),
      evidenceStore: {
        writeArtifact: (name, value) => artifacts.push([name, value]),
        finalize: () => { throw new Error("manifest unavailable"); },
      },
      executeScenario: async () => ({ scenarioId: scenario.id, status: "passed" }),
    }),
    /manifest unavailable/,
  );
  assert.deepEqual(artifacts.map(([name]) => name), ["cleanup.json", "runner-error.json"]);
});

test("runner persists the same budgeted metadata-rich final result it returns", async () => {
  let persisted;
  const moments = [
    new Date("2026-07-19T00:00:00.000Z"),
    new Date("2026-07-19T00:00:01.250Z"),
  ];
  const provider = providerFake({
    name: "docker",
    projectName: "archive-acceptance-run-001",
    resources: { cpu: 2, memoryMb: 4096 },
    endpoints: { next: "http://127.0.0.1:43123" },
    imageDigests: ["sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  });
  const result = await runAcceptance({
    scenarios: [scenario],
    provider,
    runMetadata: { sourceCommit: "a".repeat(40), appVersion: "1.0.0-rc.1" },
    now: () => moments.shift(),
    evidenceStore: {
      writeArtifact: () => {},
      finalize: (value) => { persisted = value; },
    },
    executeScenario: async () => ({
      scenarioId: scenario.id,
      status: "passed",
      evidence: { refs: ["V1-IA-ARCH-001-attempt-1.json"] },
    }),
  });
  assert.deepEqual(persisted, result);
  assert.deepEqual(result.budget, { logins: 1, refreshes: 1 });
  assert.equal(result.sourceCommit, "a".repeat(40));
  assert.equal(result.appVersion, "1.0.0-rc.1");
  assert.equal(result.startedAt, "2026-07-19T00:00:00.000Z");
  assert.equal(result.finishedAt, "2026-07-19T00:00:01.250Z");
  assert.equal(result.durationMs, 1_250);
  assert.deepEqual(result.provider, {
    name: "docker",
    capabilities: ["docker"],
    project: "archive-acceptance-run-001",
    resources: { cpu: 2, memoryMb: 4096 },
    endpoints: { next: "http://127.0.0.1:43123" },
    imageDigests: ["sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  });
  assert.deepEqual(result.results[0].attemptResults[0].evidence.refs, ["V1-IA-ARCH-001-attempt-1.json"]);
});

test("executor errors retain a bounded sanitized diagnostic and concrete classification", async () => {
  const failure = new Error(`spawn failed token=super-secret ${"x".repeat(1_000)}`);
  failure.code = "ENOENT";
  const result = await runAcceptance({
    scenarios: [scenario],
    provider: providerFake(),
    executeScenario: async () => { throw failure; },
  });
  assert.equal(result.results[0].classification, "platform");
  assert.equal(result.results[0].reason, "executor-error");
  assert.ok(result.results[0].detail.length <= 512);
  assert.doesNotMatch(result.results[0].detail, /super-secret/);
});

test("CLI reserves exit two for invalid input and returns one for runtime or evidence failures", async () => {
  assert.equal(await main(["run", "--unknown"]), 2);

  const runtimeExit = await main(["run", "--tag", "smoke"], {
    createProvider: () => providerFake({ prepare: async () => { throw new Error("Docker unavailable"); } }),
    createStore: () => ({ writeArtifact: () => {}, finalize: () => {} }),
  });
  assert.equal(runtimeExit, 1);

  const evidenceExit = await main(["run", "--tag", "smoke"], {
    createProvider: () => providerFake(),
    createStore: () => ({ writeArtifact: () => {}, finalize: () => { throw new Error("evidence unavailable"); } }),
    executeScenario: async ({ scenario: current }) => ({ scenarioId: current.id, status: "passed" }),
  });
  assert.equal(evidenceExit, 1);
});

test("CLI accepts tag, repeated ids, and last-failed selection without ambiguous input", () => {
  assert.deepEqual(parseAcceptanceArguments(["run", "--tag", "smoke"]), {
    command: "run",
    tag: "smoke",
    ids: undefined,
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

test("CLI resolves a deterministic commit and package version without exposing repository metadata", () => {
  assert.deepEqual(resolveRunMetadata(process.cwd(), { SOURCE_COMMIT: "B".repeat(40) }, () => assert.fail("git must not run")), {
    sourceCommit: "b".repeat(40),
    appVersion: "1.0.0-rc.1",
  });
});

test("CLI resolves run metadata before creating a provider with temporary credentials", async () => {
  let providerCreated = false;
  const exitCode = await main(["run", "--tag", "smoke"], {
    createRunMetadata: () => { throw new Error("commit unavailable"); },
    createProvider: () => { providerCreated = true; return providerFake(); },
    createStore: () => ({ directory: "test-evidence", writeArtifact: () => {}, finalize: () => {} }),
  });
  assert.equal(exitCode, 1);
  assert.equal(providerCreated, false);
});

test("runner bounds destroy independently and reports cleanup unproved on timeout", async () => {
  const timers = [];
  const resultPromise = runAcceptance({
    scenarios: [scenario],
    provider: providerFake({ destroy: async () => new Promise(() => {}) }),
    executeScenario: async () => ({ scenarioId: scenario.id, status: "passed" }),
    setTimer: (callback, milliseconds) => {
      const timer = { callback, milliseconds };
      timers.push(timer);
      return timer;
    },
    clearTimer: () => {},
    cleanupDeadlineMs: 250,
  });
  while (!timers.some(({ milliseconds }) => milliseconds === 250)) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  timers.find(({ milliseconds }) => milliseconds === 250).callback();
  const result = await resultPromise;
  assert.deepEqual(result.cleanup, { keptForDiagnostics: false, proved: false, timedOut: true });
  assert.equal(result.exitCode, 1);
});
