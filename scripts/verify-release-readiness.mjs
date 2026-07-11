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
const nextPkg = json("archive-next/package.json");
const laravelPkg = json("archive-laravel/package.json");
const laravelComposer = json("archive-laravel/composer.json");

for (const [name, pkg] of Object.entries({ root: rootPkg, app: appPkg, core: corePkg, next: nextPkg, server: serverPkg })) {
  assert.equal(pkg.engines?.node, ">=22.12.0", `${name} package should require Node.js 22.12+`);
}

assertExcludes("INSTALL.md", "Node.js 18+");
assertIncludes("INSTALL.md", "Node.js 22.12+");
assertIncludes("DEPLOYMENT.md", "Node.js 22.12+");
assertIncludes("scripts/node-version.mjs", 'MIN_NODE_VERSION = "22.12.0"');

assert.equal(rootPkg.scripts?.dev, "node scripts/dev-laravel-next.mjs", "root dev should run Laravel + Next.js");
assert.equal(rootPkg.scripts?.build, "pnpm run build:next", "root build should build Next.js");
assert.equal(rootPkg.scripts?.verify, "pnpm run verify:laravel-next", "root verify should target Laravel + Next.js");
assert.equal(rootPkg.scripts?.server, "node scripts/laravel-docker.mjs serve", "root server should run Laravel");
assert.ok(rootPkg.scripts?.["dev:legacy"], "legacy Vite dev should be explicit");
assert.ok(rootPkg.scripts?.["server:legacy"], "legacy Node server should be explicit");
assert.ok(rootPkg.scripts?.["verify:legacy"], "legacy verification should be explicit");
assert.ok(rootPkg.scripts?.["verify:laravel-next:live"], "live Laravel/Next integration gate should exist");
assert.ok(laravelComposer.scripts?.setup, "Laravel composer setup should exist");
assert.ok(!laravelComposer.scripts.setup.some((step) => step.includes("npm run build")), "Laravel setup should not build a Laravel Vite frontend");
assert.ok(!laravelComposer.scripts.dev.some((step) => step.includes("npm run dev") || step.includes("vite")), "Laravel composer dev should not start a Vite frontend");
assert.ok(!laravelPkg.devDependencies?.vite, "Laravel npm package should not depend on Vite after cutover");

for (const script of [
  "security:baseline",
  "security:audit",
  "verify:cutover",
  "verify:laravel",
  "verify:laravel-next",
  "ci",
  "ci:docker",
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

assertIncludes("archive-next/next.config.mjs", "ARCHIVE_API_BASE_URL");
assertExcludes("archive-next/next.config.mjs", "withSentryConfig");
assertExcludes("archive-next/package.json", "@sentry/nextjs");
assertExcludes("archive-laravel/composer.json", "sentry/sentry-laravel");
assertIncludes("archive-laravel/Dockerfile.worker", "libcurl4-openssl-dev");
assertIncludes("archive-laravel/Dockerfile.worker", "docker-php-ext-install curl mbstring zip pdo pdo_pgsql");
assertIncludes("archive-next/Dockerfile", "COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./");
assertIncludes("archive-next/Dockerfile", "ARG ARCHIVE_API_BASE_URL=http://laravel:8000/api/v1");
assertIncludes("archive-next/Dockerfile", "COPY --from=builder /app/archive-next/public ./archive-next/public");
assertIncludes("archive-server/docker-compose.yml", "dockerfile: archive-next/Dockerfile");
assertIncludes("archive-server/docker-compose.yml", "archive-ln-laravel");
assertIncludes("archive-server/docker-compose.yml", "CADDY_UPSTREAM: next:3000");
assertIncludes("archive-server/deploy/Caddyfile", 'reverse_proxy {$CADDY_UPSTREAM:frontend:80}');
assertIncludes("archive-laravel/routes/api.php", "Route::prefix('v1')");
assertIncludes("archive-laravel/routes/api.php", "archive.auth");
assertIncludes("archive-laravel/ARCHIVE_MIGRATION.md", "canonical API target");
assertIncludes("CLAUDE.md", "Frontend (canonical)");
assertIncludes("CLAUDE.md", "`archive-next`");
assertIncludes("CLAUDE.md", "Backend (canonical)");
assertIncludes("CLAUDE.md", "`archive-laravel`");

assertIncludes("archive-server/src/index.js", "./index.ts");
assertIncludes("archive-server/src/index.ts", "assertProductionSecrets");
assertIncludes("archive-server/scripts/verify-deployment.mjs", "assertProductionSecrets");

assertIncludes(".github/workflows/ci.yml", "pnpm run verify:laravel");
assertIncludes(".github/workflows/ci.yml", "node scripts/verify-release-readiness.mjs");
assertIncludes(".github/workflows/docker.yml", "docker compose --env-file archive-server/.env.example -f archive-server/docker-compose.yml build next");
assertIncludes(".github/workflows/docker.yml", "ghcr.io/${{ github.repository }}/masar-next");

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
