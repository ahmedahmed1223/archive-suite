import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, datasetEvidenceErrors, environmentProfileErrors, loadPerformanceContract, metricBudgets, validatePerformanceContract } from "./performance-contract.mjs";

/**
 * The machine this run was actually measured on. Recorded because
 * resourceProfileId is copied from the contract — without an observed
 * counterpart, every run silently claims the declared baseline profile
 * regardless of where it ran. performance-regression.mjs compares the two.
 */
function readCgroupLimits() {
  // os.cpus() and os.totalmem() read /proc, which reports the HOST inside a
  // container — a `--cpus=4 --memory=8g` container would otherwise look like
  // the 28-thread host it runs on. cgroup v2 is where the real limits live.
  const read = (file) => { try { return readFileSync(file, "utf8").trim(); } catch { return null; } };
  const toGiB = (bytes) => Math.round((Number(bytes) / 1024 ** 3) * 10) / 10;

  // cgroup v2 first, then v1 — Docker Desktop on WSL2 still exposes v1.
  const v2 = read("/sys/fs/cgroup/cpu.max");
  if (v2 && v2 !== "max") {
    const [quota, period] = v2.split(/\s+/);
    const memory = read("/sys/fs/cgroup/memory.max");
    return { cpus: Math.round(Number(quota) / Number(period)), memoryGiB: memory && memory !== "max" ? toGiB(memory) : null };
  }

  const quotaV1 = Number(read("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"));
  const periodV1 = Number(read("/sys/fs/cgroup/cpu/cpu.cfs_period_us"));
  const memoryV1 = Number(read("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
  if (!Number.isFinite(quotaV1) || quotaV1 <= 0 || !periodV1) return { cpus: null, memoryGiB: null };

  // v1 writes an "unlimited" memory limit as a huge sentinel, not a flag.
  const unlimited = memoryV1 >= Number.MAX_SAFE_INTEGER || memoryV1 > 1024 ** 5;
  return { cpus: Math.round(quotaV1 / periodV1), memoryGiB: unlimited ? null : toGiB(memoryV1) };
}

function readOsRelease() {
  const contents = (() => { try { return readFileSync("/etc/os-release", "utf8"); } catch { return ""; } })();
  const values = Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
  }));
  return { id: values.ID?.toLowerCase() ?? null, versionId: values.VERSION_ID ?? null };
}

export function observeEnvironmentProfile() {
  const limits = readCgroupLimits();
  return {
    platform: os.platform(),
    cpus: limits.cpus ?? os.cpus().length,
    memoryGiB: limits.memoryGiB ?? Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    constrained: limits.cpus !== null,
    osRelease: readOsRelease()
  };
}

function requiredMetrics(contract) {
  return Object.keys(metricBudgets(contract));
}

export function eventErrors(events, expectedMetrics, inputName) {
  if (!Array.isArray(events)) return [`${inputName} must contain a JSON array of measurement events.`];
  const errors = [];
  for (const [index, event] of events.entries()) {
    if (!expectedMetrics.includes(event?.metric)) errors.push(`${inputName}[${index}].metric is not required by the contract.`);
    if (!Number.isFinite(event?.value) || event.value < 0) errors.push(`${inputName}[${index}].value must be a finite non-negative number.`);
  }
  return errors;
}

export function measurementSampleErrors(contract, events) {
  return requiredMetrics(contract).flatMap((metric) => {
    const count = events.filter((event) => event?.metric === metric && Number.isFinite(event.value) && event.value >= 0).length;
    return count < contract.measurement.minimumSamples ? [`${metric} requires ${contract.measurement.minimumSamples} samples.`] : [];
  });
}

export function collectionErrors(contract, environment, datasetEvidence, frontendEvents, apiEvents, observedEnvironment = observeEnvironmentProfile()) {
  const allEvents = Array.isArray(frontendEvents) && Array.isArray(apiEvents) ? [...frontendEvents, ...apiEvents] : [];
  return [
    ...validatePerformanceContract(contract),
    ...(contract.measurement.environments.includes(environment) ? [] : ["run environment is not declared by the contract."]),
    ...datasetEvidenceErrors(contract, datasetEvidence),
    ...environmentProfileErrors(contract, observedEnvironment),
    ...eventErrors(frontendEvents, requiredMetrics(contract), "frontend events"),
    ...eventErrors(apiEvents, requiredMetrics(contract), "API events"),
    ...measurementSampleErrors(contract, allEvents)
  ];
}

/** Normalizes frontend web-vitals and API timing event arrays into one run artifact. */
export function buildPerformanceRun(contract, environment, datasetEvidence, frontendEvents, apiEvents) {
  const measurements = Object.fromEntries(requiredMetrics(contract).map((metric) => [metric, []]));
  for (const event of [...frontendEvents, ...apiEvents]) {
    if (Object.hasOwn(measurements, event?.metric) && Number.isFinite(event.value)) measurements[event.metric].push(event.value);
  }
  return {
    contractVersion: contract.contractVersion,
    resourceProfileId: contract.resourceProfile.id,
    environmentProfile: observeEnvironmentProfile(),
    environment,
    datasetEvidence,
    collectedAt: new Date().toISOString(),
    measurements
  };
}

async function main(environment, datasetPath, frontendPath, apiPath, outputPath) {
  const contract = await loadPerformanceContract();
  const [datasetEvidence, frontendEvents, apiEvents] = await Promise.all([datasetPath, frontendPath, apiPath].map(async (file) => JSON.parse(await readFile(path.resolve(ROOT, file), "utf8"))));
  const errors = collectionErrors(contract, environment, datasetEvidence, frontendEvents, apiEvents);
  if (errors.length) throw new Error(`Performance collection rejected:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  const run = buildPerformanceRun(contract, environment, datasetEvidence, frontendEvents, apiEvents);
  const target = path.resolve(ROOT, outputPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`wrote ${target}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , environment, datasetPath, frontendPath, apiPath, outputPath] = process.argv;
  if (!environment || !datasetPath || !frontendPath || !apiPath || !outputPath) { console.error("Usage: node scripts/performance-collect.mjs <docker|native> <dataset-manifest.json> <frontend-events.json> <api-events.json> <run.json>"); process.exitCode = 1; }
  else {
    try { await main(environment, datasetPath, frontendPath, apiPath, outputPath); }
    catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
  }
}
