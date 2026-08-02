import assert from "node:assert/strict";
import test from "node:test";
import { loadPerformanceContract, validatePerformanceContract } from "../scripts/performance-contract.mjs";
import { evaluatePerformanceRun, percentile } from "../scripts/performance-regression.mjs";

test("V1 performance contract has reproducible resource and budget requirements", async () => {
  assert.deepEqual(validatePerformanceContract(await loadPerformanceContract()), []);
});

test("performance gate rejects a budget regression", async () => {
  const contract = await loadPerformanceContract();
  const samples = Array.from({ length: 20 }, () => 1);
  const result = evaluatePerformanceRun(contract, {
    contractVersion: "v1", environment: "docker", resourceProfileId: contract.resourceProfile.id,
    measurements: { lcpP75Ms: Array.from({ length: 20 }, () => 2501), clsP75: samples, inpP75Ms: samples, searchP95Ms: samples, recordOpenP95Ms: samples, uploadSessionStartP95Ms: samples }
  });
  assert.equal(percentile([1, 2, 3, 4], 75), 3);
  assert.equal(result.passed, false);
  assert.deepEqual(result.violations[0], { metric: "lcpP75Ms", actual: 2501, budget: 2500 });
});

test("performance gate rejects a run measured off the declared resource profile", async () => {
  const contract = await loadPerformanceContract();
  const samples = Array.from({ length: 20 }, () => 1);
  // clsP75's budget is 0.1, so the 1s used elsewhere would be a real violation.
  const measurements = { lcpP75Ms: samples, clsP75: samples.map(() => 0.01), inpP75Ms: samples, searchP95Ms: samples, recordOpenP95Ms: samples, uploadSessionStartP95Ms: samples };
  const base = { contractVersion: "v1", environment: "docker", resourceProfileId: contract.resourceProfile.id, measurements };

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
