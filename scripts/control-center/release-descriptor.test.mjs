import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadOfflineReleaseImages, loadReleaseDescriptor, resolveRelease } from "./release-descriptor.mjs";

const configuration = (overrides = {}) => ({ mode: "docker", source: "online", runtimeProfiles: ["core"], ...overrides });

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

test("verified offline images are loaded and inspected before the release adapter can compose", () => {
  const calls = [];
  loadOfflineReleaseImages({
    environment: { ARCHIVE_RELEASE_PULL_POLICY: "never" },
    images: [
      { archive: "C:/bundle/images/laravel.tar", checksum: "a".repeat(64), reference: "archive-suite/laravel:1.0.0-rc.1" },
      { archive: "C:/bundle/images/laravel.tar", checksum: "a".repeat(64), reference: "archive-suite/laravel:1.0.0-rc.1" },
      { archive: "C:/bundle/images/next.tar", checksum: "b".repeat(64), reference: "archive-suite/next:1.0.0-rc.1" },
    ],
  }, { runDocker: (args) => calls.push(args) });
  assert.deepEqual(calls, [
    ["image", "load", "--input", "C:/bundle/images/laravel.tar"],
    ["image", "inspect", "archive-suite/laravel:1.0.0-rc.1"],
    ["image", "inspect", "archive-suite/laravel:1.0.0-rc.1"],
    ["image", "load", "--input", "C:/bundle/images/next.tar"],
    ["image", "inspect", "archive-suite/next:1.0.0-rc.1"],
  ]);
});
