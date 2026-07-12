import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ponytail: the xlsx-specific allowlist was here for archive-app/archive-server,
// which vendored an unpatched xlsx release. Both packages are gone (2026-07-12);
// archive-next does not depend on xlsx, so there is nothing left to allow-list.
const allowedAdvisories = new Map();

const result = spawnSync("pnpm", ["audit", "--audit-level", "moderate", "--json"], {
  cwd: ROOT,
  encoding: "utf8",
  shell: process.platform === "win32",
  windowsHide: true,
});

if (result.error) {
  throw result.error;
}

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch (error) {
  console.error(result.stdout);
  console.error(result.stderr);
  throw new Error(`Unable to parse pnpm audit JSON: ${error.message}`);
}

const advisories = Object.values(report.advisories ?? {});
const unexpected = [];
const allowed = [];

for (const advisory of advisories) {
  const id = advisory.github_advisory_id;
  const reason = allowedAdvisories.get(id);

  if (reason) {
    allowed.push({ id, title: advisory.title, reason });
    continue;
  }

  unexpected.push(advisory);
}

if (unexpected.length > 0) {
  for (const advisory of unexpected) {
    console.error(`${advisory.severity}: ${advisory.module_name} ${advisory.github_advisory_id} - ${advisory.title}`);
  }
  process.exit(1);
}

if (allowed.length > 0) {
  for (const advisory of allowed) {
    console.log(`allowed: ${advisory.id} - ${advisory.reason}`);
  }
}

console.log("ok - dependency audit gate");
