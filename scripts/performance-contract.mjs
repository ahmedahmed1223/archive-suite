import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_PATH = path.join(ROOT, "docs", "performance", "baseline.v1.json");
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function validatePerformanceContract(contract) {
  const errors = [];
  if (contract?.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (contract?.contractVersion !== "v1") errors.push("contractVersion must equal v1.");
  if (!contract?.resourceProfile?.id || !Array.isArray(contract.resourceProfile.viewportWidths) || contract.resourceProfile.viewportWidths.length < 3) errors.push("resourceProfile must declare the three required viewport widths.");
  if (!positive(contract?.dataset?.records) || !positive(contract?.dataset?.files) || !positive(contract?.dataset?.sampleBytes)) errors.push("dataset sizes must be positive.");
  if (!Array.isArray(contract?.requiredRoutes) || contract.requiredRoutes.length < 5) errors.push("requiredRoutes must cover daily frontend routes.");
  if (!Array.isArray(contract?.requiredApiOperations) || contract.requiredApiOperations.length < 3) errors.push("requiredApiOperations must cover search, record open, and upload session start.");
  if (!positive(contract?.measurement?.minimumSamples) || contract.measurement.minimumSamples < 20) errors.push("measurement.minimumSamples must be at least 20.");
  if (!Array.isArray(contract?.measurement?.environments) || !["docker", "native"].every((name) => contract.measurement.environments.includes(name))) errors.push("measurement.environments must include docker and native.");
  for (const [name, value] of Object.entries({ ...contract?.budgets?.frontend, ...contract?.budgets?.api })) if (!positive(value)) errors.push(`budget ${name} must be positive.`);
  return errors;
}

export async function loadPerformanceContract() {
  return JSON.parse(await readFile(CONTRACT_PATH, "utf8"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validatePerformanceContract(await loadPerformanceContract());
  if (errors.length) { errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; }
  else console.log("ok - V1 performance contract");
}
