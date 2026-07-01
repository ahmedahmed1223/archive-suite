import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const allowedAdvisories = new Map([
  [
    "GHSA-4r6h-8v6p-xvw6",
    "xlsx has no patched npm release; legacy imports are constrained to guarded OOXML reads and workbook writes.",
  ],
  [
    "GHSA-5pgg-2g8v-p4x9",
    "xlsx has no patched npm release; legacy imports reject non-OOXML payloads and cap import size.",
  ],
]);

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

  if (
    reason &&
    advisory.module_name === "xlsx" &&
    advisory.findings?.every((finding) =>
      finding.paths?.every((findingPath) =>
        findingPath === "archive-app>xlsx" || findingPath === "archive-server>xlsx"
      )
    )
  ) {
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
