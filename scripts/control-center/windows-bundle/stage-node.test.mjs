import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageNodeRuntime, NODE_VERSION, NODE_WINDOWS_SHA256, NODE_WINDOWS_URL } from "./stage-node.mjs";

test("stageNodeRuntime downloads the pinned zip, verifies checksum, extracts node.exe", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-node-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-node-zip"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      const nodeSubdir = join(targetDir, `node-v${NODE_VERSION}-win-x64`);
      mkdirSync(nodeSubdir, { recursive: true });
      writeFileSync(join(nodeSubdir, "node.exe"), "");
    };
    const result = await stageNodeRuntime({ destDir, fetch, extract, sha256: () => NODE_WINDOWS_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], NODE_WINDOWS_URL);
    assert.ok(existsSync(result.nodeExePath));
    assert.match(NODE_WINDOWS_URL, new RegExp(NODE_VERSION.replace(/\./g, "\\.")));
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
