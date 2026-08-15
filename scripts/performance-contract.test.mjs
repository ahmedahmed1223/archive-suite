import test from "node:test";
import assert from "node:assert/strict";
import { datasetEvidenceErrors, loadPerformanceContract, metricBudgets, validatePerformanceContract } from "./performance-contract.mjs";
import { collectionErrors, eventErrors } from "./performance-collect.mjs";

test("performance contract rejects an unavailable dataset manifest", async () => {
  const contract = await loadPerformanceContract();
  const invalid = { ...contract, dataset: { ...contract.dataset, manifest: "tests/fixtures/benchmark/missing-recipe.json" } };

  assert.ok(validatePerformanceContract(invalid).includes("dataset.manifest must resolve to a checked-in benchmark recipe."));
});

test("performance contract defines all V3 attribution metrics", async () => {
  const contract = await loadPerformanceContract();
  assert.deepEqual(Object.keys(metricBudgets(contract)).sort(), [
    "clsP75", "inpP75Ms", "javascriptBytesP75", "lcpP75Ms", "previewStartupP95Ms",
    "queueLatencyP95Ms", "recordOpenP95Ms", "searchP95Ms", "studioOpenP95Ms", "uploadSessionStartP95Ms"
  ]);
});

test("collector input validation rejects a mismatched dataset and invalid events", async () => {
  const contract = await loadPerformanceContract();
  assert.equal(datasetEvidenceErrors(contract, { seed: 42, records: 100000, files: 10000, filesBytes: 1, store: "benchmark-synthetic" }).length, 1);
  assert.deepEqual(eventErrors([{ metric: "inventedP95Ms", value: 1 }], Object.keys(metricBudgets(contract)), "frontend events"), [
    "frontend events[0].metric is not required by the contract."
  ]);
});

test("collector rejects an undeclared environment and incomplete samples before writing evidence", async () => {
  const contract = await loadPerformanceContract();
  const errors = collectionErrors(
    contract,
    "unsupported",
    { seed: 42, records: 100000, files: 10000, filesBytes: 1073741824, store: "benchmark-synthetic" },
    [],
    [],
    { platform: "linux", cpus: 4, memoryGiB: 8 }
  );
  assert.ok(errors.includes("run environment is not declared by the contract."));
  assert.ok(errors.includes("studioOpenP95Ms requires 20 samples."));
});
