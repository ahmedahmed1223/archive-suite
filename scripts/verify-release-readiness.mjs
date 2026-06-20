import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function assertIncludes(file, expected) {
  assert.match(read(file), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} should include ${expected}`);
}

function assertExcludes(file, forbidden) {
  assert.doesNotMatch(read(file), new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} should not include ${forbidden}`);
}

const rootPkg = json("package.json");
const appPkg = json("archive-app/package.json");
const serverPkg = json("archive-server/package.json");
const corePkg = json("archive-core/package.json");

for (const [name, pkg] of Object.entries({ root: rootPkg, app: appPkg, core: corePkg, server: serverPkg })) {
  assert.equal(pkg.engines?.node, ">=22.12.0", `${name} package should require Node.js 22.12+`);
}

assertIncludes("archive-server/.env.example", "BACKEND=postgres");
assertExcludes("INSTALL.md", "Node.js 18+");
assertIncludes("INSTALL.md", "Node.js 22.12+");
assertIncludes("DEPLOYMENT.md", "Node.js 22.12+");
assertIncludes("scripts/node-version.mjs", 'MIN_NODE_VERSION = "22.12.0"');

for (const script of [
  "audit:ui",
  "audit:ui:headed",
  "audit:ui:server",
  "audit:all",
  "security:baseline",
  "docker:config",
  "docker:config:postgres",
  "release:verify"
]) {
  assert.ok(rootPkg.scripts?.[script], `root package.json should expose ${script}`);
}

for (const script of ["audit:ui", "audit:ui:headed", "audit:ui:server"]) {
  assert.ok(appPkg.scripts?.[script], `@archive/app should expose ${script}`);
}

assert.equal(appPkg.scripts.check, "pnpm run verify && pnpm run build:spa", "@archive/app check should use pnpm");
assert.equal(serverPkg.scripts.check, "pnpm run verify", "archive-server check should use pnpm");
assert.ok(serverPkg.scripts["verify:deployment"], "archive-server should expose verify:deployment");

assertIncludes("archive-server/Dockerfile.server", "corepack enable");
assertIncludes("archive-server/Dockerfile.server", "pnpm install --frozen-lockfile");
assertIncludes("archive-server/Dockerfile.server", "pnpm --filter archive-server");
assertExcludes("archive-server/Dockerfile.server", "package-lock.json");
assertExcludes("archive-server/Dockerfile.server", "npm ci");

assertIncludes("archive-server/Dockerfile.frontend", "corepack enable");
assertIncludes("archive-server/Dockerfile.frontend", "pnpm --filter @archive/app run build:cloud");
assertExcludes("archive-server/Dockerfile.frontend", "git clone");
assertExcludes("archive-server/Dockerfile.frontend", "APP_REPO");

assertIncludes("archive-server/docker-compose.postgres.yml", "context: ..");
assertIncludes("archive-server/docker-compose.postgres.yml", "dockerfile: archive-server/Dockerfile.server");
assertIncludes("archive-server/docker-compose.postgres.yml", "dockerfile: archive-server/Dockerfile.frontend");
assertExcludes("archive-server/docker-compose.postgres.yml", "APP_REPO");
assertExcludes("archive-server/docker-compose.yml", "APP_REPO");

assertIncludes("archive-server/src/index.js", "assertProductionSecrets");
assertIncludes("archive-server/scripts/verify-deployment.mjs", "assertProductionSecrets");

const audit = read("archive-app/scripts/comprehensive-ui-audit.mjs");
assertIncludes("archive-app/scripts/run-interactive-audit.mjs", "comprehensive-ui-audit.mjs");
assert.match(appPkg.scripts["audit:ui"], /run-interactive-audit\.mjs/, "@archive/app audit:ui should start its own preview");
for (const needle of [
  "E2E_MODE",
  "E2E_OUTPUT_DIR",
  "E2E_ALLOW_SERVER_MUTATION",
  "report.html",
  "screenshots",
  "mobile-390",
  "tablet-768",
  "desktop-1440"
]) {
  assert.match(audit, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `interactive audit should include ${needle}`);
}

console.log("ok - release readiness wiring");
