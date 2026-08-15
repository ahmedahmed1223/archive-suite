import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_PATH = path.join(ROOT, "docs", "performance", "baseline.v1.json");
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const REQUIRED_METRICS = {
  lcpP75Ms: { percentile: 75, source: "browser" },
  clsP75: { percentile: 75, source: "browser" },
  inpP75Ms: { percentile: 75, source: "browser" },
  javascriptBytesP75: { percentile: 75, source: "browser" },
  searchP95Ms: { percentile: 95, source: "api" },
  recordOpenP95Ms: { percentile: 95, source: "api" },
  uploadSessionStartP95Ms: { percentile: 95, source: "api" },
  studioOpenP95Ms: { percentile: 95, source: "api" },
  previewStartupP95Ms: { percentile: 95, source: "workflow" },
  queueLatencyP95Ms: { percentile: 95, source: "queue" }
};

export function metricBudgets(contract) {
  return Object.assign({}, contract?.budgets?.frontend, contract?.budgets?.api, contract?.budgets?.workflow);
}

export function environmentProfileErrors(contract, observed) {
  if (!observed || typeof observed !== "object") return ["run must record environmentProfile (regenerate it with scripts/performance-collect.mjs)."];

  const errors = [];
  const declared = contract.resourceProfile;
  const declaredCpus = Number.parseInt(String(declared.cpu), 10);

  if (/ubuntu|linux/i.test(declared.os) && observed.platform !== "linux") errors.push(`environmentProfile.platform is ${observed.platform}; the profile declares ${declared.os}.`);
  if (Number.isFinite(declaredCpus) && observed.cpus !== declaredCpus) errors.push(`environmentProfile.cpus is ${observed.cpus}; the profile declares ${declaredCpus}.`);
  if (Math.abs(Number(observed.memoryGiB) - Number(declared.memoryGiB)) > 1) errors.push(`environmentProfile.memoryGiB is ${observed.memoryGiB}; the profile declares ${declared.memoryGiB}.`);
  return errors;
}

/** Rejects generator output unless it proves the exact contract dataset. */
export function datasetEvidenceErrors(contract, evidence) {
  if (!evidence || typeof evidence !== "object") return ["dataset evidence must be a JSON object emitted by the benchmark generator."];
  const actualBytes = evidence.filesBytes ?? evidence.sampleBytes;
  const checks = [
    ["seed", evidence.seed, contract.dataset.seed],
    ["records", evidence.records, contract.dataset.records],
    ["files", evidence.files, contract.dataset.files],
    ["filesBytes", actualBytes, contract.dataset.sampleBytes],
    ["store", evidence.store, contract.dataset.store]
  ];
  return checks.filter(([, actual, expected]) => actual !== expected)
    .map(([name, actual, expected]) => `dataset evidence ${name} is ${JSON.stringify(actual)}; the contract requires ${JSON.stringify(expected)}.`);
}

export function validatePerformanceContract(contract) {
  const errors = [];
  if (contract?.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (contract?.contractVersion !== "v1") errors.push("contractVersion must equal v1.");
  if (!contract?.resourceProfile?.id || !Array.isArray(contract.resourceProfile.viewportWidths) || contract.resourceProfile.viewportWidths.length < 3) errors.push("resourceProfile must declare the three required viewport widths.");
  if (contract?.resourceProfile?.os !== "Ubuntu 24.04 LTS x64" || contract?.resourceProfile?.cpu !== "4 vCPU" || contract?.resourceProfile?.memoryGiB !== 8) errors.push("resourceProfile must declare Ubuntu 24.04 x64, 4 vCPU, and 8 GiB.");
  if (contract?.dataset?.records !== 100000 || contract?.dataset?.files !== 10000 || contract?.dataset?.sampleBytes !== 1073741824) errors.push("dataset must declare exactly 100000 records, 10000 files, and 1 GiB.");
  if (contract?.dataset?.generator !== "php artisan archive:generate-benchmark-dataset" || contract?.dataset?.seed !== 42 || contract?.dataset?.store !== "benchmark-synthetic") errors.push("dataset must declare the approved deterministic generator, seed, and store.");
  if (typeof contract?.dataset?.manifest !== "string" || !existsSync(path.resolve(ROOT, contract.dataset.manifest))) errors.push("dataset.manifest must resolve to a checked-in benchmark recipe.");
  if (!Array.isArray(contract?.requiredRoutes) || !["/", "/archive", "/archive/:id", "/search", "/uploads", "/types"].every((route) => contract.requiredRoutes.includes(route))) errors.push("requiredRoutes must cover daily frontend routes and the studio.");
  if (!Array.isArray(contract?.requiredApiOperations) || !["search", "record-open", "upload-session-start", "studio-open", "preview-startup", "queue-latency"].every((operation) => contract.requiredApiOperations.includes(operation))) errors.push("requiredApiOperations must cover search, record open, upload, studio, preview, and queues.");
  if (!positive(contract?.measurement?.minimumSamples) || contract.measurement.minimumSamples < 20) errors.push("measurement.minimumSamples must be at least 20.");
  if (!Array.isArray(contract?.measurement?.environments) || !["docker", "native"].every((name) => contract.measurement.environments.includes(name))) errors.push("measurement.environments must include docker and native.");
  for (const [name, expected] of Object.entries(REQUIRED_METRICS)) {
    const actual = contract?.measurement?.requiredMetrics?.[name];
    if (actual?.percentile !== expected.percentile || actual?.source !== expected.source) errors.push(`measurement.requiredMetrics.${name} must declare P${expected.percentile} from ${expected.source}.`);
  }
  const budgets = metricBudgets(contract);
  for (const name of Object.keys(REQUIRED_METRICS)) if (!positive(budgets[name])) errors.push(`budget ${name} must be positive.`);
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
