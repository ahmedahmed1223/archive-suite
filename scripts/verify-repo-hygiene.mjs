import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GIT_SAFE_ROOT = ROOT.replace(/\\/g, "/");

const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  ".vite",
  ".tmp",
  "dist",
  "dist-cloud",
  "node_modules",
  "storage",
  "vendor",
]);

const forbiddenDirectoryNames = new Set([
  "blob-report",
  "playwright-report",
  "test-results",
]);

const forbiddenRootFilePatterns = [
  /^next-.*\.log$/i,
  /^settings-.*\.png$/i,
  /^vite-dev-.*\.(?:log|out\.log|err\.log)$/i,
];

const requiredGitignoreEntries = [
  "*.log",
  "**/test-results/",
  "**/playwright-report/",
  "**/blob-report/",
  "**/.next/",
];

const taskLedgerRelativePath = "TASKS.md";
const forbiddenPlanDocPaths = [
  "docs/design/masar-legacy-parity-audit.md",
  "docs/design/masar-rich-ui-completion-audit.md",
  "docs/design/masar-ui-redesign-vision.md",
  "docs/laravel-nextjs-migration-plan.md",
];
const requiredTaskLedgerMarkers = [
  "Activity/history دائم",
  "تخزين Laravel دائم",
  "Add archive / AddVideo wizard",
  "Automation backend",
  "تفريغ عربي إنتاجي على GPU",
  "AI/Copilot",
];
const requiredCompletedMarkers = [
  "First-run / onboarding في Masar",
];

function rel(absolutePath) {
  return path.relative(ROOT, absolutePath).replaceAll(path.sep, "/");
}

function scanDirectory(directory, findings) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = rel(absolutePath);

    if (entry.isDirectory()) {
      if (forbiddenDirectoryNames.has(entry.name)) {
        findings.push(relativePath);
        continue;
      }

      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }

      scanDirectory(absolutePath, findings);
      continue;
    }

    if (directory === ROOT && forbiddenRootFilePatterns.some((pattern) => pattern.test(entry.name))) {
      findings.push(relativePath);
    }
  }
}

const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
for (const entry of requiredGitignoreEntries) {
  assert.ok(gitignore.includes(entry), `.gitignore should include ${entry}`);
}

const findings = [];
scanDirectory(ROOT, findings);

assert.deepEqual(
  findings,
  [],
  `Generated QA/build artifacts must not be left in the repo:\n${findings.join("\n")}`
);

const forbiddenTrackedPrefixes = [
  ".superpowers/",
  "output/",
  ".fallow/",
  ".agents/",
];

const trackedFiles = execFileSync("git", ["-c", `safe.directory=${GIT_SAFE_ROOT}`, "ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const forbiddenTracked = trackedFiles.filter((file) =>
  forbiddenTrackedPrefixes.some((prefix) => file.startsWith(prefix))
);
assert.deepEqual(
  forbiddenTracked,
  [],
  `Local tool/agent state must not be git-tracked:\n${forbiddenTracked.join("\n")}`
);

const packageJsonScripts = JSON.stringify(
  JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts ?? {}
);
const strayRootVerifyScripts = trackedFiles.filter(
  (file) => /^verify-[^/]+\.mjs$/.test(file) && !packageJsonScripts.includes(file)
);
assert.deepEqual(
  strayRootVerifyScripts,
  [],
  `Stray root verify-*.mjs scripts not referenced from package.json:\n${strayRootVerifyScripts.join("\n")}`
);

for (const file of [
  taskLedgerRelativePath,
  "ChangeLog.md",
  "package.json",
]) {
  assert.ok(existsSync(path.join(ROOT, file)), `missing expected root file: ${file}`);
  assert.ok(statSync(path.join(ROOT, file)).isFile(), `expected file: ${file}`);
}

const taskLedger = readFileSync(path.join(ROOT, taskLedgerRelativePath), "utf8");
for (const marker of requiredTaskLedgerMarkers) {
  assert.ok(taskLedger.includes(marker), `${taskLedgerRelativePath} should include task marker: ${marker}`);
}

const changeLog = readFileSync(path.join(ROOT, "ChangeLog.md"), "utf8");
for (const marker of requiredCompletedMarkers) {
  assert.ok(changeLog.includes(marker), `ChangeLog.md should include completed marker: ${marker}`);
}

const trackedForbiddenPlanDocs = trackedFiles.filter((file) =>
  forbiddenPlanDocPaths.includes(file) && existsSync(path.join(ROOT, file))
);
assert.deepEqual(
  trackedForbiddenPlanDocs,
  [],
  `Merged plan/audit documents must not remain tracked; consolidate into ${taskLedgerRelativePath}:\n${trackedForbiddenPlanDocs.join("\n")}`
);

const trackedSuperpowersPlans = trackedFiles.filter((file) =>
  file.startsWith("docs/superpowers/plans/") && existsSync(path.join(ROOT, file))
);
assert.deepEqual(
  trackedSuperpowersPlans,
  [],
  `Subtask plan documents must not remain tracked; consolidate into ${taskLedgerRelativePath}:\n${trackedSuperpowersPlans.join("\n")}`
);

console.log("Repo hygiene verification complete.");
