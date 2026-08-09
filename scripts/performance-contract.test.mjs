import test from "node:test";
import assert from "node:assert/strict";
import { loadPerformanceContract, validatePerformanceContract } from "./performance-contract.mjs";

test("performance contract rejects an unavailable dataset manifest", async () => {
  const contract = await loadPerformanceContract();
  const invalid = { ...contract, dataset: { ...contract.dataset, manifest: "tests/fixtures/benchmark/missing-recipe.json" } };

  assert.ok(validatePerformanceContract(invalid).includes("dataset.manifest must resolve to a checked-in benchmark recipe."));
});
