import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeReleaseMetadata, writeNativeReleaseMetadata } from "./native-release-metadata.mjs";

const digest = "a".repeat(64);

test("creates portable metadata for a Windows Native release", () => {
  const metadata = createNativeReleaseMetadata({
    version: "1.5.1",
    platform: "windows",
    archiveName: "archive-suite-v1.5.1-windows-native.tar.gz",
    archiveSha256: digest,
    builtAt: "2026-08-28T12:00:00Z",
  });

  assert.deepEqual(metadata, {
    schemaVersion: 1,
    version: "1.5.1",
    platform: "windows-x64",
    builtAt: "2026-08-28T12:00:00Z",
    archive: { name: "archive-suite-v1.5.1-windows-native.tar.gz", sha256: digest },
    releaseNotes: "docs/release-notes/v1.5.1.md",
  });
});

test("rejects incomplete or unsafe release metadata", () => {
  assert.throws(() => createNativeReleaseMetadata({ version: "v1.5.1", platform: "windows", archiveName: "x", archiveSha256: digest, builtAt: "2026-08-28T12:00:00Z" }), /version/);
  assert.throws(() => createNativeReleaseMetadata({ version: "1.5.1", platform: "macos", archiveName: "x", archiveSha256: digest, builtAt: "2026-08-28T12:00:00Z" }), /platform/);
  assert.throws(() => createNativeReleaseMetadata({ version: "1.5.1", platform: "linux", archiveName: "x", archiveSha256: "bad", builtAt: "2026-08-28T12:00:00Z" }), /SHA-256/);
  assert.throws(() => createNativeReleaseMetadata({ version: "1.5.1", platform: "linux", archiveName: "x", archiveSha256: digest, builtAt: "2026-08-28" }), /builtAt/);
});

test("writes RELEASE.json before refreshing the bundle inventory", () => {
  const bundlePath = mkdtempSync(join(tmpdir(), "archive-native-release-"));
  try {
    const metadata = createNativeReleaseMetadata({ version: "1.5.1", platform: "linux", archiveName: "archive-suite-v1.5.1-linux-native.tar.gz", archiveSha256: digest, builtAt: "2026-08-28T12:00:00Z" });
    const calls = [];
    writeNativeReleaseMetadata({ bundlePath, metadata, writeChecksums: (path) => { calls.push(path); return 1; } });
    assert.deepEqual(JSON.parse(readFileSync(join(bundlePath, "RELEASE.json"), "utf8")), metadata);
    assert.deepEqual(calls, [bundlePath]);
  } finally {
    rmSync(bundlePath, { recursive: true, force: true });
  }
});
