import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));

test("canonical toolchain pins are declared and consumed without floating runtime tags", () => {
  const toolchain = json("infra/platform/toolchain.v1.json");
  const rootPackage = json("package.json");
  const composerLock = json("archive-laravel/composer.lock");
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
  assert.equal(composerLock["plugin-api-version"], `${toolchain.composer.slice(0, 3)}.0`);
  assert.match(nextDockerfile, new RegExp(`FROM node:${toolchain.node.replaceAll(".", "\\.")}-alpine`));
  assert.match(laravelDockerfile, new RegExp(`FROM php:${toolchain.php.replaceAll(".", "\\.")}-fpm`));
  assert.match(laravelDockerfile, new RegExp(`FROM composer:${toolchain.composer.replaceAll(".", "\\.")} AS composer`));
  for (const workflow of workflows) {
    assert.match(workflow, new RegExp(`node-version: "${toolchain.node.replaceAll(".", "\\.")}"`));
    assert.match(workflow, /pnpm install --frozen-lockfile/);
  }
});

test("root frozen install and reproducibility verification are canonical gates", () => {
  const rootPackage = json("package.json");
  const readme = read("README.md");

  assert.equal(rootPackage.scripts.bootstrap, "pnpm install --frozen-lockfile");
  assert.equal(rootPackage.scripts["verify:reproducibility"], "node --test scripts/verify-reproducibility.test.mjs");
  assert.match(rootPackage.scripts["verify:laravel-next"], /verify:reproducibility/);
  assert.match(readme, /pnpm install --frozen-lockfile/);
});
