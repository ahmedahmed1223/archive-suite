import test from "node:test";
import assert from "node:assert/strict";
import { loadPerformanceContract, validatePerformanceContract } from "./performance-contract.mjs";

test("performance contract rejects an unavailable dataset manifest", async () => {
  const contract = await loadPerformanceContract();
  const invalid = { ...contract, dataset: { ...contract.dataset, manifest: "docs/acceptance/datasets/missing-manifest.json" } };

  assert.ok(validatePerformanceContract(invalid).includes("dataset.manifest must resolve to a checked-in benchmark recipe."));
});
