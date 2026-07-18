import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateThresholdContract } from "./verify-service-extraction-thresholds.mjs";

const canonical = JSON.parse(readFileSync(path.resolve("docs/architecture/service-extraction-thresholds.v1.json"), "utf8"));
const clone = () => structuredClone(canonical);

test("canonical service extraction threshold contract is valid", () => {
  assert.deepEqual(validateThresholdContract(canonical), []);
});

test("rejects an evidence window shorter than fourteen days", () => {
  const contract = clone();
  contract.measurement.minimumWindowDays = 13;
  assert.ok(validateThresholdContract(contract).some((error) => error.includes("minimumWindowDays")));
});

test("requires at least two media extraction indicators", () => {
  const contract = clone();
  contract.mediaWorker.minimumIndicatorsRequired = 1;
  assert.ok(validateThresholdContract(contract).some((error) => error.includes("minimumIndicatorsRequired")));
});

test("rejects percentages outside zero to one hundred", () => {
  const contract = clone();
  contract.mediaWorker.indicators.resourceUtilization.thresholdPercent = 101;
  assert.ok(validateThresholdContract(contract).some((error) => error.includes("thresholdPercent")));
});

test("rejects non-positive sample sizes", () => {
  const contract = clone();
  contract.measurement.minimumSampleSize = 0;
  assert.ok(validateThresholdContract(contract).some((error) => error.includes("minimumSampleSize")));
});

test("requires at least one qualifying outbox trigger", () => {
  const contract = clone();
  contract.outbox.triggers = {};
  assert.ok(validateThresholdContract(contract).some((error) => error.includes("outbox.triggers")));
});
