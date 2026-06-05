import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

function git(args) {
  return execFileSync("git", ["-c", "safe.directory=D:/archiveaq/Arch_App", ...args], {
    cwd: ROOT,
    encoding: "utf8"
  }).trim();
}

const tracked = git(["ls-files"]).split(/\r?\n/).filter(Boolean);

assert.equal(tracked.some((file) => /(^|\/)\.env($|\.)/.test(file) && !file.endsWith(".env.example")), false, "tracked .env files are not allowed");
assert.equal(tracked.some((file) => file.endsWith("package-lock.json")), false, "package-lock.json should not be tracked in the pnpm workspace");
assert.equal(tracked.some((file) => file.startsWith(".codex-scan/")), false, ".codex-scan artifacts should not be tracked");

const activeConfigFiles = tracked.filter((file) =>
  /(^|\/)(Dockerfile|docker-compose.*\.yml|package\.json|\.env\.example)$/.test(file)
);

for (const file of activeConfigFiles) {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  assert.doesNotMatch(text, /APP_REPO|APP_REF|archive-app\.git|package-lock\.json|npm ci/, `${file} contains stale split-repo/npm deployment wiring`);
}

const envExample = readFileSync(path.join(ROOT, "archive-server/.env.example"), "utf8");
assert.match(envExample, /^ARCHIVE_PUBLIC_DEPLOY=1$/m, ".env.example should document public deploy guard");
assert.match(envExample, /^JWT_SECRET=$/m, ".env.example should require operator-supplied JWT_SECRET");
assert.match(envExample, /^ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD$/m, ".env.example should require a strong first admin password");

console.log("ok - security baseline");
