import assert from "node:assert/strict";
import test from "node:test";
import { datasetEvidenceErrors, loadPerformanceContract, metricBudgets, validatePerformanceContract } from "../scripts/performance-contract.mjs";
import { evaluatePerformanceRun, percentile } from "../scripts/performance-regression.mjs";

test("V1 performance contract has reproducible resource and budget requirements", async () => {
  assert.deepEqual(validatePerformanceContract(await loadPerformanceContract()), []);
});

test("performance gate rejects a budget regression", async () => {
  const contract = await loadPerformanceContract();
  const samples = Array.from({ length: 20 }, () => 1);
  const measurements = Object.fromEntries(Object.keys(metricBudgets(contract)).map((metric) => [metric, samples]));
  measurements.clsP75 = samples.map(() => 0.01);
  measurements.lcpP75Ms = Array.from({ length: 20 }, () => 2501);
  const result = evaluatePerformanceRun(contract, {
    contractVersion: "v1", environment: "docker", resourceProfileId: contract.resourceProfile.id,
    environmentProfile: { platform: "linux", cpus: 4, memoryGiB: 8 },
    datasetEvidence: { seed: 42, records: 100000, files: 10000, filesBytes: 1073741824, store: "benchmark-synthetic" },
    measurements
  });
  assert.equal(percentile([1, 2, 3, 4], 75), 3);
  assert.equal(result.passed, false);
  assert.deepEqual(result.violations[0], { metric: "lcpP75Ms", actual: 2501, budget: 2500 });
});

test("performance gate rejects a run measured off the declared resource profile", async () => {
  const contract = await loadPerformanceContract();
  const samples = Array.from({ length: 20 }, () => 1);
  // clsP75's budget is 0.1, so the 1s used elsewhere would be a real violation.
  const measurements = Object.fromEntries(Object.keys(metricBudgets(contract)).map((metric) => [metric, samples]));
  measurements.clsP75 = samples.map(() => 0.01);
  const datasetEvidence = { seed: 42, records: 100000, files: 10000, filesBytes: 1073741824, store: "benchmark-synthetic" };
  const base = { contractVersion: "v1", environment: "docker", resourceProfileId: contract.resourceProfile.id, datasetEvidence, measurements };

  // Within budget on every metric, but measured on a developer workstation.
  const foreign = evaluatePerformanceRun(contract, { ...base, environmentProfile: { platform: "win32", cpus: 28, memoryGiB: 31.7 } });
  assert.equal(foreign.passed, false);
  assert.equal(foreign.violations.length, 0, "budgets are met; only the attribution must fail");
  assert.equal(foreign.errors.length, 3);

  // An absent observation must not pass either.
  assert.equal(evaluatePerformanceRun(contract, base).passed, false);

  // The declared profile itself passes.
  assert.equal(evaluatePerformanceRun(contract, { ...base, environmentProfile: { platform: "linux", cpus: 4, memoryGiB: 8 } }).passed, true);
});

test("performance gate rejects benchmark evidence with a smaller dataset", async () => {
  const contract = await loadPerformanceContract();
  const errors = datasetEvidenceErrors(contract, { seed: 42, records: 99999, files: 10000, filesBytes: 1073741824, store: "benchmark-synthetic" });
  assert.deepEqual(errors, ["dataset evidence records is 99999; the contract requires 100000."]);
});
