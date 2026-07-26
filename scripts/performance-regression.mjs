import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadPerformanceContract, validatePerformanceContract } from "./performance-contract.mjs";

export function percentile(values, percentage) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1)];
}

export function evaluatePerformanceRun(contract, run) {
  const errors = validatePerformanceContract(contract);
  const violations = [];
  if (!run || run.contractVersion !== contract.contractVersion) errors.push("run contractVersion must match the baseline contract.");
  if (!contract.measurement.environments.includes(run?.environment)) errors.push("run environment is not declared by the contract.");
  if (run?.resourceProfileId !== contract.resourceProfile.id) errors.push("run resourceProfileId must match the baseline resource profile.");
  const measurements = run?.measurements || {};
  const metricBudgets = {
    lcpP75Ms: contract.budgets.frontend.lcpP75Ms,
    clsP75: contract.budgets.frontend.clsP75,
    inpP75Ms: contract.budgets.frontend.inpP75Ms,
    searchP95Ms: contract.budgets.api.searchP95Ms,
    recordOpenP95Ms: contract.budgets.api.recordOpenP95Ms,
    uploadSessionStartP95Ms: contract.budgets.api.uploadSessionStartP95Ms
  };
  for (const [metric, budget] of Object.entries(metricBudgets)) {
    const samples = measurements[metric];
    if (!Array.isArray(samples) || samples.length < contract.measurement.minimumSamples) { errors.push(`${metric} requires ${contract.measurement.minimumSamples} samples.`); continue; }
    const actual = percentile(samples, metric.includes("P95") ? 95 : 75);
    if (actual > budget) violations.push({ metric, actual, budget });
  }
  return { errors, violations, passed: errors.length === 0 && violations.length === 0 };
}

async function main(file) {
  const contract = await loadPerformanceContract();
  const run = JSON.parse(await readFile(path.resolve(ROOT, file), "utf8"));
  const result = evaluatePerformanceRun(contract, run);
  if (result.passed) { console.log("ok - V1 performance regression gate"); return; }
  result.errors.forEach((error) => console.error(`- ${error}`));
  result.violations.forEach(({ metric, actual, budget }) => console.error(`- ${metric}: ${actual} exceeds ${budget}`));
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node scripts/performance-regression.mjs <run.json>"); process.exitCode = 1; }
  else await main(file);
}
