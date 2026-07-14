import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { cleanupRehearsal, resolveReleaseInventory } from "./offline-bundle.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const required = [
  "infra/offline/compose.v1.yml",
  "infra/offline/images.v1.json",
  "infra/offline/install.sh",
  "infra/offline/install.ps1",
  "infra/offline/generate-env.mjs",
  "infra/offline/verify-bundle.mjs",
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
  for (const service of ["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "laravel-reverb", "next"]) {
    assert.match(compose, new RegExp(`^  ${service}:`, "m"));
  }
  assert.doesNotMatch(compose, /^  ocr:/m);
  assert.doesNotMatch(compose, /^  caddy:/m);
});

test("image inventory matches the immutable release descriptor's complete core service set", () => {
  const inventory = JSON.parse(read("infra/offline/images.v1.json"));
  assert.deepEqual(inventory.images.map(({ id }) => id), ["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "laravel-reverb", "next"]);
  for (const image of inventory.images) {
    assert.match(image.bundleRef, /^archive-suite\/[a-z-]+:\$VERSION$/);
    assert.equal(image.source, undefined, "production sources are injected only after signature verification");
  }
  assert.ok(!inventory.images.some((image) => image.id === "caddy" || image.id === "ocr"));
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
    assert.match(installer, /verify-bundle\.mjs/);
    assert.match(installer, /docker\s+(?:image\s+)?load/i);
    assert.doesNotMatch(installer, /docker\s+(?:compose\s+)?(?:pull|build)|curl|wget|Invoke-WebRequest/i);
  }
});

test("semantic verifier rejects files outside the manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-offline-test-"));
  try {
    cpSync(new URL("infra/offline/verify-bundle.mjs", root), join(dir, "verify-bundle.mjs"));
    cpSync(new URL("infra/offline/images.v1.json", root), join(dir, "images.v1.json"));
    writeFileSync(join(dir, "payload.txt"), "ok\n");
    writeFileSync(join(dir, "extra.log"), "uncovered\n");
    writeFileSync(join(dir, "SHA256SUMS"), "");
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ schemaVersion: 1, version: "v1.0.0", profile: "core", images: [], files: [] }));
    const result = spawnSync(process.execPath, [join(dir, "verify-bundle.mjs"), dir], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unexpected file/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("semantic verifier enforces image archive checksum and inventory reference", () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-offline-image-test-"));
  const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  try {
    cpSync(new URL("infra/offline/verify-bundle.mjs", root), join(dir, "verify-bundle.mjs"));
    writeFileSync(join(dir, "images.v1.json"), JSON.stringify({ images: [{ id: "next", kind: "application", source: "registry.test/next:1.0.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", bundleRef: "archive-suite/next:$VERSION" }] }));
    cpSync(join(dir, "images.v1.json"), join(dir, "next.tar"));
    writeFileSync(join(dir, "SHA256SUMS"), "");
    const records = ["verify-bundle.mjs", "images.v1.json", "next.tar"].map((path) => ({ path, bytes: readFileSync(join(dir, path)).length, sha256: hash(join(dir, path)) }));
    const manifest = { schemaVersion: 1, version: "v1.0.0", profile: "core", images: [{ id: "next", kind: "application", source: "registry.test/next:1.0.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", bundleRef: "wrong/ref:v1.0.0", archive: "next.tar", sha256: records[2].sha256 }], files: records };
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
    const result = spawnSync(process.execPath, [join(dir, "verify-bundle.mjs"), dir], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /image metadata mismatch/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("core rehearsal automates isolated up, HTTP, finally cleanup, and absence checks", () => {
  const script = read("scripts/offline-bundle.mjs");
  assert.match(script, /up[^\n]+--wait/);
  assert.match(script, /http:\/\/localhost/);
  assert.doesNotMatch(script, /https:\/\/localhost/);
  assert.match(script, /finally/);
  assert.match(script, /down[^\n]+--volumes/);
  assert.match(script, /com\.docker\.compose\.project/);
});

test("cleanup deletes rehearsal secrets and checks networks when compose down fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-cleanup-test-"));
  const envPath = join(dir, ".env.rehearsal");
  writeFileSync(envPath, "PASSWORD=never-log-this\n");
  const attempted = [];
  const fakeRun = (command, args) => {
    attempted.push([command, ...args].join(" "));
    if (args.includes("down")) throw new Error("simulated down failure");
    return "";
  };
  assert.throws(() => cleanupRehearsal({ project: "archive-suite-v1-206-test", compose: ["compose"], envPath, runCommand: fakeRun }), /simulated down failure/);
  assert.equal(existsSync(envPath), false);
  assert.ok(attempted.some((line) => line.includes("docker ps") && line.includes("archive-suite-v1-206-test")));
  assert.ok(attempted.some((line) => line.includes("docker volume ls") && line.includes("archive-suite-v1-206-test")));
  assert.ok(attempted.some((line) => line.includes("docker network ls") && line.includes("archive-suite-v1-206-test")));
  rmSync(dir, { recursive: true, force: true });
});

test("evidence binds source commit, manifest, final archive, exact counts, core HTTP and cleanup absence", () => {
  const script = read("scripts/offline-bundle.mjs");
  for (const field of ["sourceCommit", "manifestSha256", "archiveSha256", "fileCount", "imageCount", "containers", "volumes", "networks"]) assert.match(script, new RegExp(field));
  assert.match(script, /fileCount:\s*14/);
  assert.match(script, /imageCount:\s*7/);
  assert.match(script, /evidence\.http/);
  assert.doesNotMatch(script, /evidence\.https/);
});

test("offline bundle resolves signature-verified workflow image refs and rejects missing or mutable inputs", () => {
  const env = {
    POSTGRES_IMAGE: "registry.test/postgres@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    REDIS_IMAGE: "registry.test/redis@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    LARAVEL_IMAGE: "registry.test/laravel@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    NEXT_IMAGE: "registry.test/next@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  };
  const resolved = resolveReleaseInventory("v1.0.0", env);
  assert.equal(resolved.find((image) => image.id === "next").source, env.NEXT_IMAGE);
  assert.equal(resolved.find((image) => image.id === "laravel-worker").source, env.LARAVEL_IMAGE);
  assert.equal(resolved.find((image) => image.id === "postgres").source, env.POSTGRES_IMAGE);
  assert.throws(() => resolveReleaseInventory("v1.0.0", { ...env, NEXT_IMAGE: "registry.test/next:latest" }), /NEXT_IMAGE/);
  assert.throws(() => resolveReleaseInventory("v1.0.0", { ...env, REDIS_IMAGE: undefined }), /REDIS_IMAGE/);
});

test("operator guide verifies top-level checksum before extraction and uses schema-compatible restore", () => {
  const guide = read("infra/offline/README.ar.md");
  assert.match(guide, /SHA256SUMS[^\n]+قبل[^\n]+فك/);
  assert.match(guide, /archive:migrate-safe/);
  assert.match(guide, /schema[^\n]+متوافق/i);
  assert.match(guide, /استعاد/);
});

test("release builds bundle after signature verification and attaches it with top-level checksum", () => {
  const release = read(".github/workflows/release.yml");
  const verified = release.indexOf("Verify keyless image signatures");
  const bundled = release.indexOf("Build offline bundle");
  assert.ok(verified >= 0 && bundled > verified);
  assert.match(release, /archive-suite-offline-[^\n]+\.tar\.gz/);
  assert.match(release, /POSTGRES_IMAGE/);
  assert.match(release, /REDIS_IMAGE/);
  assert.match(release, /NEXT_IMAGE: "\$\{\{ env\.NEXT_IMAGE \}\}@/);
  assert.match(release, /SHA256SUMS/);
  assert.match(release, /basename[^\n]+offline_bundle/);
  assert.match(release, /gh release create[^\n]+\$\{offline_asset\}/);
  assert.doesNotMatch(release, /sha256sum[^\n]+offline_bundle/);
});

test("top-level checksum verifies the flat GitHub Release download layout", () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-release-download-"));
  try {
    const asset = "archive-suite-offline-v1.0.0.tar.gz";
    writeFileSync(join(dir, asset), "release asset bytes");
    const digest = createHash("sha256").update(readFileSync(join(dir, asset))).digest("hex");
    writeFileSync(join(dir, "SHA256SUMS"), `${digest}  ${asset}\n`);
    const [expected, downloadedName] = readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split(/\s{2}/);
    assert.equal(downloadedName, asset);
    assert.equal(createHash("sha256").update(readFileSync(join(dir, downloadedName))).digest("hex"), expected);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
