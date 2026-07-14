import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadOfflineReleaseImages, loadReleaseDescriptor, resolveRelease } from "./release-descriptor.mjs";

const configuration = (overrides = {}) => ({ mode: "docker", source: "online", runtimeProfiles: ["core"], ...overrides });
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function validCoreBundle() {
  const dir = mkdtempSync(join(tmpdir(), "release-offline-core-"));
  const descriptor = loadReleaseDescriptor();
  const images = descriptor.images.filter((image) => image.profile === "core").map((image) => {
    const application = ["next", "laravel", "laravel-fpm", "laravel-worker", "laravel-reverb"].includes(image.service);
    return { id: image.id, kind: "application", source: application ? `ghcr.io/workflow/${image.id === "next" ? "next" : "laravel"}@sha256:${image.id === "next" ? "d".repeat(64) : "c".repeat(64)}` : image.online, bundleRef: image.offlineRef.replace("$VERSION", descriptor.version) };
  });
  writeFileSync(join(dir, "images.v1.json"), JSON.stringify({ schemaVersion: 1, profile: "core", images }));
  writeFileSync(join(dir, "verify-bundle.mjs"), readFileSync(new URL("../../infra/offline/verify-bundle.mjs", import.meta.url)));
  mkdirSync(join(dir, "images"));
  const files = ["images.v1.json", "verify-bundle.mjs"];
  const manifestImages = images.map((image) => {
    const archive = `images/${image.id}.tar`; const archivePath = join(dir, archive);
    writeFileSync(archivePath, `verified ${image.id}`); files.push(archive);
    return { ...image, archive, sha256: sha256(archivePath) };
  });
  const records = files.map((path) => ({ path, bytes: readFileSync(join(dir, path)).length, sha256: sha256(join(dir, path)) }));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ schemaVersion: 1, version: `v${descriptor.version}`, profile: "core", images: manifestImages, files: records }));
  writeFileSync(join(dir, "SHA256SUMS"), "");
  return dir;
}

test("online release resolves core to immutable version+digest image references without optional services", () => {
  const release = resolveRelease({ configuration: configuration() });
  assert.equal(release.descriptor.version, "1.0.0-rc.1");
  assert.equal(release.environment.ARCHIVE_RELEASE_PULL_POLICY, "missing");
  assert.deepEqual(release.environment.ARCHIVE_COMPOSE_PROFILES, "");
  assert.ok(release.images.every((image) => /:1\.0\.0-rc\.1@sha256:[a-f0-9]{64}$/.test(image.reference)));
  assert.ok(!release.images.some((image) => image.service === "ocr" || image.service === "caddy"));
});

test("release enables media and edge only when explicitly requested", () => {
  const release = resolveRelease({ configuration: configuration({ runtimeProfiles: ["core", "media", "edge"] }) });
  assert.equal(release.environment.ARCHIVE_COMPOSE_PROFILES, "media,edge");
  assert.ok(release.images.some((image) => image.service === "ocr"));
  assert.ok(release.images.some((image) => image.service === "caddy"));
});

test("release rejects a missing core profile before Compose", () => {
  assert.throws(() => resolveRelease({ configuration: configuration({ runtimeProfiles: ["media"] }) }), { code: "RELEASE_PROFILE_INVALID" });
});

test("release contract rejects a floating or mismatched image descriptor", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-descriptor-"));
  const descriptor = {
    schemaVersion: "1.0", version: "1.0.0",
    images: ["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "laravel-reverb", "next"].map((service) => ({ id: service, service, profile: "core", online: `registry.test/${service}:latest`, offlineRef: `archive/${service}:$VERSION` })),
  };
  const path = join(dir, "release.json");
  writeFileSync(path, JSON.stringify(descriptor));
  assert.throws(() => loadReleaseDescriptor(path), { code: "RELEASE_DESCRIPTOR_INVALID" });
});

test("offline release requires a verifiable bundle before Compose", () => {
  assert.throws(() => resolveRelease({ configuration: configuration({ source: "offline" }), offlineBundlePath: join(tmpdir(), "missing-bundle") }), { code: "OFFLINE_BUNDLE_REQUIRED" });
});

test("a complete core offline bundle resolves, verifies, loads, tags, and inspects before Compose", () => {
  const bundle = validCoreBundle();
  const release = resolveRelease({ configuration: configuration({ source: "offline" }), offlineBundlePath: bundle });
  assert.equal(release.images.length, 7);
  assert.equal(release.environment.ARCHIVE_RELEASE_PULL_POLICY, "never");
  assert.deepEqual(release.images.map((image) => image.service).sort(), ["laravel", "laravel-fpm", "laravel-reverb", "laravel-worker", "next", "postgres", "redis"]);
  assert.match(release.images.find((image) => image.service === "next").online, /^ghcr\.io\/workflow\/next@sha256:/);
  const calls = [];
  loadOfflineReleaseImages(release, { runDocker: (args) => calls.push(args) });
  assert.equal(calls.filter((args) => args[1] === "load").length, 7);
  assert.equal(calls.filter((args) => args[1] === "tag").length, 7);
  assert.equal(calls.filter((args) => args[1] === "inspect").length, 14);
});

test("verified offline images are loaded and inspected before the release adapter can compose", () => {
  const calls = [];
  loadOfflineReleaseImages({
    environment: { ARCHIVE_RELEASE_PULL_POLICY: "never" },
    images: [
      { archive: "C:/bundle/images/laravel.tar", checksum: "a".repeat(64), reference: "archive-suite/laravel:1.0.0-rc.1", online: `registry.test/laravel:1.0.0-rc.1@sha256:${"a".repeat(64)}` },
      { archive: "C:/bundle/images/laravel.tar", checksum: "a".repeat(64), reference: "archive-suite/laravel:1.0.0-rc.1", online: `registry.test/laravel:1.0.0-rc.1@sha256:${"a".repeat(64)}` },
      { archive: "C:/bundle/images/next.tar", checksum: "b".repeat(64), reference: "archive-suite/next:1.0.0-rc.1", online: `registry.test/next:1.0.0-rc.1@sha256:${"b".repeat(64)}` },
    ],
  }, { runDocker: (args) => calls.push(args) });
  assert.deepEqual(calls, [
    ["image", "load", "--input", "C:/bundle/images/laravel.tar"],
    ["image", "tag", "archive-suite/laravel:1.0.0-rc.1", "registry.test/laravel:1.0.0-rc.1"],
    ["image", "inspect", "registry.test/laravel:1.0.0-rc.1"],
    ["image", "inspect", "archive-suite/laravel:1.0.0-rc.1"],
    ["image", "tag", "archive-suite/laravel:1.0.0-rc.1", "registry.test/laravel:1.0.0-rc.1"],
    ["image", "inspect", "registry.test/laravel:1.0.0-rc.1"],
    ["image", "inspect", "archive-suite/laravel:1.0.0-rc.1"],
    ["image", "load", "--input", "C:/bundle/images/next.tar"],
    ["image", "tag", "archive-suite/next:1.0.0-rc.1", "registry.test/next:1.0.0-rc.1"],
    ["image", "inspect", "registry.test/next:1.0.0-rc.1"],
    ["image", "inspect", "archive-suite/next:1.0.0-rc.1"],
  ]);
});
