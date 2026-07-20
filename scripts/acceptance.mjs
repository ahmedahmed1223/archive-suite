import { createServer } from "node:net";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEvidenceStore } from "./acceptance/evidence.mjs";
import { createDockerProvider } from "./acceptance/providers/docker.mjs";
import { AcceptanceInputError, runAcceptance } from "./acceptance/runner.mjs";

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), "..");
const DEFAULT_EVIDENCE_ROOT = join(tmpdir(), "archive-acceptance");

export function parseAcceptanceArguments(argv) {
  const [command, ...args] = argv;
  if (command !== "run") throw new AcceptanceInputError("usage: acceptance.mjs run [--tag <tag>] [--id <scenario-id>] [--last-failed] [--keep-environment]");

  const options = { command, tag: undefined, ids: undefined, lastFailed: false, keepEnvironment: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--tag" || argument === "--id") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new AcceptanceInputError(`${argument} requires a value`);
      if (argument === "--tag") {
        if (options.tag) throw new AcceptanceInputError("--tag may be supplied only once");
        options.tag = value;
      } else {
        options.ids ??= [];
        options.ids.push(value);
      }
      index += 1;
    } else if (argument === "--last-failed") {
      if (options.lastFailed) throw new AcceptanceInputError("--last-failed may be supplied only once");
      options.lastFailed = true;
    } else if (argument === "--keep-environment") {
      options.keepEnvironment = true;
    } else {
      throw new AcceptanceInputError(`unknown acceptance option: ${argument}`);
    }
  }
  return options;
}

export function findLastFailedManifest(root = DEFAULT_EVIDENCE_ROOT) {
  if (!existsSync(root)) throw new Error("--last-failed requires a previous acceptance manifest");
  const manifests = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "manifest.json"))
    .filter((path) => existsSync(path))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  for (const path of manifests) {
    try {
      const manifest = JSON.parse(readFileSync(path, "utf8"));
      if (manifest?.results?.some((result) => result.status === "failed")) return manifest;
    } catch {
      // A malformed prior artifact is not a valid source for a targeted rerun.
    }
  }
  throw new Error("--last-failed found no previous failed acceptance scenarios");
}

export function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("could not allocate an acceptance port"));
        return;
      }
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

export async function main(argv = process.argv.slice(2), {
  root = ROOT,
  evidenceRoot = DEFAULT_EVIDENCE_ROOT,
  createProvider = createDockerProvider,
  createStore = createEvidenceStore,
  executeScenario,
  now = () => new Date(),
} = {}) {
  try {
    const options = parseAcceptanceArguments(argv);
    const runId = `run-${now().toISOString().replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}`;
    const evidenceStore = createStore({ root: evidenceRoot, runId, now: now() });
    const provider = createProvider({ root, runId, getFreePort });
    const result = await runAcceptance({
      ...options,
      provider,
      evidenceStore,
      executeScenario,
      readLastFailed: () => findLastFailedManifest(evidenceRoot),
    });
    process.stdout.write(`${JSON.stringify({ status: result.status, exitCode: result.exitCode, selected: result.selected, evidenceDirectory: evidenceStore.directory })}\n`);
    return result.exitCode;
  } catch (error) {
    process.stderr.write(`acceptance: ${error instanceof Error ? error.message : String(error)}\n`);
    return error instanceof AcceptanceInputError ? 2 : 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
