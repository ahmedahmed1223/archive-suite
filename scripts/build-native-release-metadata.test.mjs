import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNativeReleaseMetadata } from "./build-native-release-metadata.mjs";

test("builds aggregate metadata from exactly one Windows and Linux archive", () => {
  const root = mkdtempSync(join(tmpdir(), "release-meta-"));
  try {
    mkdirSync(join(root, "nested"));
    writeFileSync(join(root, "archive-suite-v1.5.1-windows-native.tar.gz"), "windows");
    writeFileSync(join(root, "nested", "archive-suite-v1.5.1-linux-native.tar.gz"), "linux");
    const metadata = buildNativeReleaseMetadata({ version: "1.5.1", assetsRoot: root, builtAt: "2026-08-30T12:00:00Z" });
    assert.deepEqual(metadata.nativeArchives.map(({ platform }) => platform), ["linux-x64", "windows-x64"]);
    assert.match(metadata.nativeArchives[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(metadata.nativeArchives[1].path, "archive-suite-v1.5.1-windows-native.tar.gz");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejects missing or mismatched Native archives", () => {
  const root = mkdtempSync(join(tmpdir(), "release-meta-invalid-"));
  try {
    writeFileSync(join(root, "archive-suite-v1.5.0-windows-native.tar.gz"), "windows");
    assert.throws(() => buildNativeReleaseMetadata({ version: "1.5.1", assetsRoot: root }), /exactly one Windows and one Linux|version does not match/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
