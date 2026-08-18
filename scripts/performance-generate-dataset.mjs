import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, datasetEvidenceErrors, loadPerformanceContract } from "./performance-contract.mjs";

/**
 * laravel-docker writes Docker build status and the Artisan result to stdout.
 * A shell redirect would mix both into the manifest. This wrapper accepts one
 * JSON object only, validates it against the contract, then writes the proof.
 */
export function parseDatasetManifestOutput(stdout) {
  const candidates = String(stdout).split(/\r?\n/).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  if (candidates.length !== 1 || !candidates[0] || typeof candidates[0] !== "object") {
    throw new Error("Dataset generator did not emit exactly one JSON manifest.");
  }
  return candidates[0];
}

function runGenerator() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join(ROOT, "scripts", "laravel-docker.mjs"),
      "artisan",
      "archive:generate-benchmark-dataset",
      "--seed=42",
      "--records=100000",
      "--files=10000",
      "--files-total-size=1073741824",
      "--json"
    ], { cwd: ROOT, shell: false });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.pipe(process.stderr);
    child.on("error", reject);
    child.on("exit", (code, signal) => code === 0 ? resolve(stdout) : reject(new Error(`Dataset generator exited with ${signal ?? code}.`)));
  });
}

async function main(outputPath) {
  const [contract, stdout] = await Promise.all([loadPerformanceContract(), runGenerator()]);
  const manifest = parseDatasetManifestOutput(stdout);
  const errors = datasetEvidenceErrors(contract, manifest);
  if (errors.length) throw new Error(`Dataset generator output was rejected:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  const target = path.resolve(ROOT, outputPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${target}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = process.argv[2];
  if (!outputPath) { console.error("Usage: node scripts/performance-generate-dataset.mjs <dataset-manifest.json>"); process.exitCode = 1; }
  else {
    try { await main(outputPath); }
    catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
  }
}
