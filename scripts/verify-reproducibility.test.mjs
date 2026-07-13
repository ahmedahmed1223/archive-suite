import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  assert.match(toolchain.node, /^22\.\d+\.\d+$/);
  assert.match(toolchain.pnpm, /^\d+\.\d+\.\d+$/);
  assert.match(toolchain.php, /^8\.4\.\d+$/);
  assert.match(toolchain.composer, /^2\.\d+\.\d+$/);
  assert.equal(rootPackage.engines.node, `>=${toolchain.node} <23`);
  assert.match(rootPackage.packageManager, new RegExp(`^pnpm@${toolchain.pnpm.replaceAll(".", "\\.")}\\+`));
  assert.match(nextDockerfile, new RegExp(`FROM node:${toolchain.node.replaceAll(".", "\\.")}-alpine@sha256:`));
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
    assert.match(platform.requirements.node, new RegExp(`>=${toolchain.node.replaceAll(".", "\\.")} <23`));
    assert.match(platform.requirements.php, new RegExp(`^${toolchain.php.replaceAll(".", "\\.")} provided`));
    assert.match(platform.requirements.composer, new RegExp(`^${toolchain.composer.replaceAll(".", "\\.")} provided`));
  }
  assert.ok(compatibility.platforms.filter(({ mode }) => mode === "native").every(({ status }) => status === "planned"));
});

test("root frozen install and reproducibility verification are canonical gates", () => {
  const rootPackage = json("package.json");
  const canonicalInstallDocs = [
    "README.md",
    "INSTALL.md",
    "DEPLOYMENT.md",
    "CLAUDE.md",
    "infra/deploy/hostinger-vps.md"
  ].map(read);
  const controlCenter = read("scripts/control-center.mjs");
  const ci = read(".github/workflows/ci.yml");

  assert.equal(rootPackage.scripts.bootstrap, "pnpm install --frozen-lockfile");
  assert.equal(rootPackage.scripts["verify:reproducibility"], "node --test scripts/verify-reproducibility.test.mjs scripts/verify-immutable-images.test.mjs scripts/verify-release-supply-chain.test.mjs");
  assert.match(rootPackage.scripts["verify:laravel-next"], /verify:reproducibility/);
  for (const document of canonicalInstallDocs) {
    assert.doesNotMatch(document, /pnpm install(?! --frozen-lockfile)/);
  }
  assert.doesNotMatch(controlCenter, /runPnpm\(\["install"\]\)/);
  assert.match(controlCenter, /runPnpm\(\["install", "--frozen-lockfile"\]\)/);
  assert.match(ci, /pnpm run verify:reproducibility/);
});
