import test from "node:test";
import assert from "node:assert/strict";
import { datasetEvidenceErrors, environmentProfileErrors, loadPerformanceContract, metricBudgets, validatePerformanceContract } from "./performance-contract.mjs";
import { collectionErrors, eventErrors } from "./performance-collect.mjs";
import { parseDatasetManifestOutput } from "./performance-generate-dataset.mjs";

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

test("environment attribution accepts only Ubuntu 24.04 with exactly 8 GiB", async () => {
  const contract = await loadPerformanceContract();
  const base = { platform: "linux", osRelease: { id: "ubuntu", versionId: "24.04" }, cpus: 4, memoryGiB: 8 };
  assert.deepEqual(environmentProfileErrors(contract, base), []);
  assert.ok(environmentProfileErrors(contract, { ...base, osRelease: { id: "debian", versionId: "12" } }).some((error) => error.includes("Ubuntu 24.04")));
  assert.ok(environmentProfileErrors(contract, { ...base, memoryGiB: 7 }).some((error) => error.includes("exactly 8")));
  assert.ok(environmentProfileErrors(contract, { ...base, memoryGiB: 9 }).some((error) => error.includes("exactly 8")));
});

test("dataset manifest wrapper extracts one JSON line instead of redirecting Docker output", () => {
  const manifest = parseDatasetManifestOutput('sha256:docker-build-output\n{"ok":true,"seed":42,"records":100000,"files":10000,"filesBytes":1073741824,"store":"benchmark-synthetic"}\n');
  assert.equal(manifest.filesBytes, 1073741824);
  assert.throws(() => parseDatasetManifestOutput('{"one":1}\n{"two":2}\n'), /exactly one JSON manifest/);
});
