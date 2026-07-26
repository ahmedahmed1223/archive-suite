import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { exportAcceptanceReport, readAcceptanceManifests } from "./acceptance/report.mjs";

function parse(argv) {
  const manifests = [];
  let outputDirectory;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--manifest") manifests.push(argv[++index]);
    else if (argv[index] === "--out") outputDirectory = argv[++index];
    else throw new Error("usage: acceptance-report.mjs --manifest <manifest.json> [--manifest <manifest.json>] --out <directory>");
  }
  if (!manifests.length || !outputDirectory || manifests.some((path) => !path || !existsSync(resolve(path)))) throw new Error("existing manifest paths and an output directory are required");
  return { manifests, outputDirectory };
}

export function main(argv = process.argv.slice(2)) {
  const { manifests, outputDirectory } = parse(argv);
  const result = exportAcceptanceReport({ manifests: readAcceptanceManifests(manifests), outputDirectory });
  process.stdout.write(`${JSON.stringify({ outputDirectory: result.directory, currentRun: result.report.currentRun, blockers: result.report.comparison.blockers.length })}\n`);
  return result;
}

if (process.argv[1]?.endsWith("acceptance-report.mjs")) main();
