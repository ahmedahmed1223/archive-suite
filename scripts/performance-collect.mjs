import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadPerformanceContract } from "./performance-contract.mjs";

const METRICS = ["lcpP75Ms", "clsP75", "inpP75Ms", "searchP95Ms", "recordOpenP95Ms", "uploadSessionStartP95Ms"];

/** Normalizes frontend web-vitals and API timing event arrays into one run artifact. */
export function buildPerformanceRun(contract, environment, frontendEvents, apiEvents) {
  const measurements = Object.fromEntries(METRICS.map((metric) => [metric, []]));
  for (const event of [...frontendEvents, ...apiEvents]) {
    if (METRICS.includes(event?.metric) && Number.isFinite(event.value)) measurements[event.metric].push(event.value);
  }
  return { contractVersion: contract.contractVersion, resourceProfileId: contract.resourceProfile.id, environment, collectedAt: new Date().toISOString(), measurements };
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
