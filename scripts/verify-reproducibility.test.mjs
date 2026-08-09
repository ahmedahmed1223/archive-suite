import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSupportedNodeVersion } from "./node-version.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));

test("canonical toolchain pins are declared and consumed without floating runtime tags", () => {
  const toolchain = json("infra/platform/toolchain.v1.json");
  const compatibility = json("infra/platform/compatibility.v1.json");
  const rootPackage = json("package.json");
  const nextDockerfile = read("archive-next/Dockerfile");
  const laravelDockerfile = read("archive-laravel/Dockerfile.worker");
  const workflows = [read(".github/workflows/ci.yml"), read(".github/workflows/release.yml")];

  assert.equal(toolchain.schemaVersion, "1.0");
  assert.match(toolchain.node, /^26\.\d+\.\d+$/);
  assert.match(toolchain.pnpm, /^\d+\.\d+\.\d+$/);
  assert.match(toolchain.php, /^8\.5\.\d+$/);
  assert.match(toolchain.composer, /^2\.\d+\.\d+$/);
  assert.equal(rootPackage.engines.node, `>=${toolchain.node} <27`);
  assert.equal(rootPackage.devDependencies.node, toolchain.node);
  assert.match(rootPackage.scripts.dev, /^node /);
  assert.match(rootPackage.packageManager, new RegExp(`^pnpm@${toolchain.pnpm.replaceAll(".", "\\.")}\\+`));
  assert.match(nextDockerfile, new RegExp(`FROM node:${toolchain.node.replaceAll(".", "\\.")}-slim@sha256:`));
  assert.match(nextDockerfile, /npm install --global corepack@0\.31\.0/);
  assert.match(nextDockerfile, new RegExp(`corepack prepare pnpm@${toolchain.pnpm.replaceAll(".", "\\.")} --activate`));
  assert.match(laravelDockerfile, new RegExp(`FROM php:${toolchain.php.replaceAll(".", "\\.")}-fpm@sha256:`));
  assert.match(laravelDockerfile, new RegExp(`FROM composer:${toolchain.composer.replaceAll(".", "\\.")}@sha256:[a-f0-9]{64} AS composer`));
  for (const workflow of workflows) {
    assert.match(workflow, new RegExp(`node-version: "${toolchain.node.replaceAll(".", "\\.")}"`));
    assert.match(workflow, /pnpm install --frozen-lockfile/);
  }
  const dockerPlatforms = compatibility.platforms.filter(({ mode }) => mode === "docker");
  for (const platform of dockerPlatforms) {
    assert.match(platform.requirements.node, new RegExp(`>=${toolchain.node.replaceAll(".", "\\.")} <27`));
    assert.match(platform.requirements.php, new RegExp(`^${toolchain.php.replaceAll(".", "\\.")} provided`));
    assert.match(platform.requirements.composer, new RegExp(`^${toolchain.composer.replaceAll(".", "\\.")} provided`));
  }
  assert.ok(compatibility.platforms.filter(({ mode }) => mode === "native").every(({ status }) => status === "supported"));
});

test("root frozen install and reproducibility verification are canonical gates", () => {
  const rootPackage = json("package.json");
  const canonicalInstallDocs = [
    "README.md",
    "INSTALL.md",
    "DEPLOYMENT.md",
    "infra/deploy/hostinger-vps.md"
  ].map(read);
  const controlCenterOperations = read("scripts/control-center/operations.mjs");
  const ci = read(".github/workflows/ci.yml");

  assert.equal(rootPackage.scripts.bootstrap, "pnpm install --frozen-lockfile");
  assert.equal(rootPackage.scripts["verify:reproducibility"], "node --test scripts/verify-reproducibility.test.mjs scripts/verify-immutable-images.test.mjs scripts/verify-release-supply-chain.test.mjs scripts/release-license-policy.test.mjs scripts/offline-bundle.test.mjs");
  assert.match(rootPackage.scripts["verify:laravel-next"], /verify:reproducibility/);
  for (const document of canonicalInstallDocs) {
    assert.doesNotMatch(document, /pnpm install(?! --frozen-lockfile)/);
  }
  assert.doesNotMatch(controlCenterOperations, /runPnpm\(\["install"\]\)/);
  assert.match(controlCenterOperations, /runPnpm\(\["install", "--frozen-lockfile"\]\)/);
  assert.match(ci, /pnpm run verify:reproducibility/);
});

test("the root Docker context excludes generated Next build output", () => {
  const dockerignore = read(".dockerignore");

  assert.match(dockerignore, /^\*\*\/\.next(?:\/)?$/m);
});

test("record attachment ownership uses the canonical users key type", () => {
  const migration = read("archive-laravel/database/migrations/2026_07_18_000002_create_record_attachments_table.php");

  assert.match(
    migration,
    /\$table->foreignId\('created_by'\)->nullable\(\)->constrained\('users'\)->nullOnDelete\(\);/
  );
  assert.doesNotMatch(migration, /foreignUuid\('created_by'\)/);
});

test("the unprivileged nginx image owns its runtime directories", () => {
  const dockerfile = read("archive-laravel/Dockerfile.worker");

  assert.match(dockerfile, /mkdir -p \/var\/lib\/nginx\/body \/var\/lib\/nginx\/fastcgi \/var\/lib\/nginx\/proxy/);
  assert.match(dockerfile, /chown -R www-data:www-data \/var\/lib\/nginx \/var\/log\/nginx/);
  assert.match(dockerfile, /sed -i 's#pid \/run\/nginx\.pid;#pid \/tmp\/nginx\.pid;#' \/etc\/nginx\/nginx\.conf/);
});

test("the Laravel image excludes local runtime storage from its build context", () => {
  const dockerignore = read("archive-laravel/.dockerignore");

  assert.match(dockerignore, /^storage\/app$/m);
});

test("the canonical FPM service consumes the deploy-time CORS origin", () => {
  const compose = read("infra/docker-compose.laravel-next.yml");

  assert.match(compose, /ARCHIVE_CORS_ORIGINS: \$\{ARCHIVE_CORS_ORIGINS:-http:\/\/localhost:3000,http:\/\/127\.0\.0\.1:3000,http:\/\/localhost:5173,http:\/\/127\.0\.0\.1:5173\}/);
});

test("the scheduler establishes its health heartbeat before entering its loop", () => {
  const compose = read("infra/docker-compose.laravel-next.yml");

  assert.match(compose, /php artisan uploads:dispatch-scheduled && exec php artisan schedule:work/);
});

test("the runtime gate accepts Node 26 and rejects other major versions", () => {
  assert.equal(isSupportedNodeVersion("v26.5.0"), true);
  assert.equal(isSupportedNodeVersion("v25.99.0"), false);
  assert.equal(isSupportedNodeVersion("v27.0.0"), false);
});
