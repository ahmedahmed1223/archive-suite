import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

for (const file of [
  "TASKS.md",
  "ChangeLog.md",
  "package.json",
]) {
  assert.ok(existsSync(path.join(ROOT, file)), `missing expected root file: ${file}`);
  assert.ok(statSync(path.join(ROOT, file)).isFile(), `expected file: ${file}`);
}

console.log("Repo hygiene verification complete.");
