import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const required = [
  "infra/offline/compose.v1.yml",
  "infra/offline/images.v1.json",
  "infra/offline/install.sh",
  "infra/offline/install.ps1",
  "infra/offline/generate-env.mjs",
  "infra/offline/README.ar.md",
  "scripts/offline-bundle.mjs",
];

test("offline payload contains Docker-only Windows and Linux entry points", () => {
  for (const path of required) assert.equal(existsSync(new URL(path, root)), true, path);
  assert.match(read("infra/offline/README.ar.md"), /Docker/);
  assert.match(read("infra/offline/README.ar.md"), /لا[^\n]*(?:native|أصلي)/i);
});

test("offline compose covers core images without builds, pulls, or floating tags", () => {
  const compose = read("infra/offline/compose.v1.yml");
  assert.doesNotMatch(compose, /^\s*build:/m);
  assert.doesNotMatch(compose, /pull_policy:\s*(?:always|missing)/);
  assert.match(compose, /pull_policy:\s*never/g);
  for (const service of ["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "laravel-reverb", "next", "caddy"]) {
    assert.match(compose, new RegExp(`^  ${service}:`, "m"));
  }
  assert.doesNotMatch(compose, /^  ocr:/m);
});

test("image inventory includes both application images and every pinned core runtime", () => {
  const inventory = JSON.parse(read("infra/offline/images.v1.json"));
  assert.deepEqual(inventory.images.map(({ id }) => id), ["next", "laravel", "postgres", "redis", "caddy"]);
  for (const image of inventory.images) {
    assert.match(image.bundleRef, /^archive-suite\/[a-z-]+:\$VERSION$/);
    if (image.kind === "runtime") assert.match(image.source, /:\S+@sha256:[a-f0-9]{64}$/);
  }
});

test("environment generator uses cryptographic randomness and never prints secrets", () => {
  const generator = read("infra/offline/generate-env.mjs");
  assert.match(generator, /randomBytes/);
  assert.doesNotMatch(generator, /console\.log\([^)]*(?:PASSWORD|SECRET|APP_KEY)/i);
  assert.doesNotMatch(generator, /CHANGE_ME|changeme|password123/i);
});

test("installers verify checksums before docker load and never access a registry", () => {
  for (const path of ["infra/offline/install.sh", "infra/offline/install.ps1"]) {
    const installer = read(path);
    assert.match(installer, /SHA256SUMS/);
    assert.match(installer, /docker\s+(?:image\s+)?load/i);
    assert.doesNotMatch(installer, /docker\s+(?:compose\s+)?(?:pull|build)|curl|wget|Invoke-WebRequest/i);
  }
});

test("release builds bundle after signature verification and attaches it with top-level checksum", () => {
  const release = read(".github/workflows/release.yml");
  const verified = release.indexOf("Verify keyless image signatures");
  const bundled = release.indexOf("Build offline bundle");
  assert.ok(verified >= 0 && bundled > verified);
  assert.match(release, /archive-suite-offline-[^\n]+\.tar\.gz/);
  assert.match(release, /SHA256SUMS/);
  assert.match(release, /gh release create[^\n]+\$\{offline_bundle\}/);
});
