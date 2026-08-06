import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePhpRuntime, PHP_WINDOWS_SHA256, PHP_WINDOWS_URL } from "./stage-php.mjs";

test("stagePhpRuntime downloads the pinned zip, verifies checksum, extracts, enables extensions", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-php-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-php-zip"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, "php.exe"), "");
    };

    const result = await stagePhpRuntime({ destDir, fetch, extract, sha256: () => PHP_WINDOWS_SHA256 });

    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], PHP_WINDOWS_URL);
    assert.ok(existsSync(result.phpExePath));

    const ini = readFileSync(join(destDir, "php.ini"), "utf8");
    for (const ext of ["curl", "ftp", "mbstring", "zip", "pdo", "pdo_pgsql"]) {
      assert.ok(ini.includes(`extension=${ext}`), `must enable extension=${ext}`);
    }
    assert.ok(!ini.includes("extension=pcntl"), "pcntl has no Windows build");
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
