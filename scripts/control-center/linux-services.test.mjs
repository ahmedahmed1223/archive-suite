import assert from "node:assert/strict";
import test from "node:test";

import { LINUX_SERVICES, LINUX_SERVICE_USER, buildLinuxPackageManifest, renderSystemdUnit } from "./linux-services.mjs";

const SHA = "a".repeat(64);
const COMMIT = "b".repeat(40);
const baseInput = () => ({
  version: "1.0.0",
  commit: COMMIT,
  files: [
    { path: "app/next/server.js", sha256: SHA },
    { path: "runtime/php/bin/php", sha256: SHA },
  ],
  artifactSignature: { signature: "minisign-synthetic", keyId: "RELEASE-KEY-1" },
});

test("Linux topology runs every required component as its own unit under the non-interactive service user", () => {
  const ids = LINUX_SERVICES.map((service) => service.id);
  assert.deepEqual(ids, ["archive-http", "archive-next", "archive-php-fpm", "archive-worker", "archive-reverb", "archive-scheduler"]);
  assert.equal(LINUX_SERVICE_USER.shell, "/usr/sbin/nologin");
  for (const service of LINUX_SERVICES) {
    assert.equal(service.user, "archive");
    assert.equal(service.unit, `${service.id}.service`);
  }
});

test("systemd unit renders restart, hardening, and scoped writable paths", () => {
  const unit = renderSystemdUnit(LINUX_SERVICES[2]);
  assert.match(unit, /User=archive/);
  assert.match(unit, /Restart=on-failure/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.match(unit, /ReadWritePaths=\/opt\/archive-suite\/storage/);
  assert.throws(() => renderSystemdUnit({ id: "rogue-service" }), (error) => error.code === "LINUX_SERVICE_UNKNOWN");
});

test("package manifest binds version and commit, checksums every file, and requires the detached signature", () => {
  const manifest = buildLinuxPackageManifest(baseInput());
  assert.equal(manifest.platform, "linux-native");
  assert.equal(manifest.commit, COMMIT);
  assert.equal(manifest.serviceUser.name, "archive");
  assert.equal(manifest.signature.keyId, "RELEASE-KEY-1");
  assert.ok(manifest.sbom.every((entry) => entry.sha256 === SHA));
});

test("package manifest rejects unsigned artifacts, bad commits, and duplicate files", () => {
  assert.throws(() => buildLinuxPackageManifest({ ...baseInput(), artifactSignature: undefined }), (error) => error.code === "LINUX_PACKAGE_UNSIGNED");
  assert.throws(() => buildLinuxPackageManifest({ ...baseInput(), commit: "short" }), (error) => error.code === "LINUX_PACKAGE_COMMIT_INVALID");
  const duplicated = baseInput();
  duplicated.files.push({ ...duplicated.files[0] });
  assert.throws(() => buildLinuxPackageManifest(duplicated), (error) => error.code === "LINUX_PACKAGE_FILE_DUPLICATE");
});
