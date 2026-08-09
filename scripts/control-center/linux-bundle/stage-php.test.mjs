import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePhpRuntime, PHP_LINUX_SHA256, PHP_LINUX_URL } from "./stage-php.mjs";

test("Linux PHP runtime uses a published immutable checksum", () => {
  assert.match(PHP_LINUX_URL, /^https:\/\/github\.com\/ahmedahmed1223\/archive-suite\/releases\/download\/php-linux-8\.5\.8-custom\//);
  assert.match(PHP_LINUX_SHA256, /^[a-f0-9]{64}$/);
});

test("stagePhpRuntime downloads the pinned tar.gz, verifies checksum, extracts, writes php.ini", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-php-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-php-tarball"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync, chmodSync } = await import("node:fs");
      mkdirSync(join(targetDir, "bin"), { recursive: true });
      mkdirSync(join(targetDir, "sbin"), { recursive: true });
      writeFileSync(join(targetDir, "bin", "php"), "");
      chmodSync(join(targetDir, "bin", "php"), 0o755);
      writeFileSync(join(targetDir, "sbin", "php-fpm"), "");
      chmodSync(join(targetDir, "sbin", "php-fpm"), 0o755);
    };

    const result = await stagePhpRuntime({ destDir, fetch, extract, sha256: () => PHP_LINUX_SHA256 });

    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], PHP_LINUX_URL);
    assert.ok(existsSync(result.phpBinPath));
    assert.equal(result.phpBinPath, join(destDir, "bin", "php"));

    const ini = readFileSync(join(destDir, "php.ini"), "utf8");
    for (const ext of ["curl", "ftp", "mbstring", "zip", "pdo", "pdo_pgsql", "pcntl"]) {
      assert.ok(ini.includes(`extension=${ext}`), `must enable extension=${ext}`);
    }
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});

test("stagePhpRuntime rejects a checksum mismatch instead of extracting", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-php-stage-"));
  try {
    const fetch = async () => Buffer.from("tampered");
    let extractCalled = false;
    const extract = async () => { extractCalled = true; };
    await assert.rejects(
      () => stagePhpRuntime({ destDir, fetch, extract, sha256: () => "0".repeat(64) }),
      /checksum mismatch/i
    );
    assert.equal(extractCalled, false);
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
