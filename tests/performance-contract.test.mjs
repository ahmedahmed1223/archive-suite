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
