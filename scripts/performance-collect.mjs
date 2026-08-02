import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadPerformanceContract } from "./performance-contract.mjs";

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

export function observeEnvironmentProfile() {
  const limits = readCgroupLimits();
  return {
    platform: os.platform(),
    cpus: limits.cpus ?? os.cpus().length,
    memoryGiB: limits.memoryGiB ?? Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    constrained: limits.cpus !== null
  };
}

const METRICS = ["lcpP75Ms", "clsP75", "inpP75Ms", "searchP95Ms", "recordOpenP95Ms", "uploadSessionStartP95Ms"];

/** Normalizes frontend web-vitals and API timing event arrays into one run artifact. */
export function buildPerformanceRun(contract, environment, frontendEvents, apiEvents) {
  const measurements = Object.fromEntries(METRICS.map((metric) => [metric, []]));
  for (const event of [...frontendEvents, ...apiEvents]) {
    if (METRICS.includes(event?.metric) && Number.isFinite(event.value)) measurements[event.metric].push(event.value);
  }
  return { contractVersion: contract.contractVersion, resourceProfileId: contract.resourceProfile.id, environmentProfile: observeEnvironmentProfile(), environment, collectedAt: new Date().toISOString(), measurements };
}

async function main(environment, frontendPath, apiPath, outputPath) {
  const contract = await loadPerformanceContract();
  const [frontendEvents, apiEvents] = await Promise.all([frontendPath, apiPath].map(async (file) => JSON.parse(await readFile(path.resolve(ROOT, file), "utf8"))));
  const run = buildPerformanceRun(contract, environment, frontendEvents, apiEvents);
  const target = path.resolve(ROOT, outputPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`wrote ${target}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , environment, frontendPath, apiPath, outputPath] = process.argv;
  if (!environment || !frontendPath || !apiPath || !outputPath) { console.error("Usage: node scripts/performance-collect.mjs <docker|native> <frontend-events.json> <api-events.json> <run.json>"); process.exitCode = 1; }
  else await main(environment, frontendPath, apiPath, outputPath);
}
