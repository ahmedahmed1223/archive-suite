import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageCaddyRuntime, CADDY_WINDOWS_SHA256, CADDY_WINDOWS_URL } from "./stage-caddy.mjs";

test("stageCaddyRuntime downloads the pinned zip, verifies checksum, extracts caddy.exe", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-caddy-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-caddy-zip"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, "caddy.exe"), "");
    };
    const result = await stageCaddyRuntime({ destDir, fetch, extract, sha256: () => CADDY_WINDOWS_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], CADDY_WINDOWS_URL);
    assert.ok(existsSync(result.caddyExePath));
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
