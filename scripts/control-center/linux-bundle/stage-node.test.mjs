import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageNodeRuntime, NODE_VERSION, NODE_LINUX_SHA256, NODE_LINUX_URL } from "./stage-node.mjs";

test("stageNodeRuntime downloads the pinned tarball, verifies checksum, extracts bin/node", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-node-stage-"));
  try {
    const fetchCalls = [];
    const fetch = async (url) => { fetchCalls.push(url); return Buffer.from("fake-node-tarball"); };
    const extract = async (_bytes, targetDir) => {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(join(targetDir, "bin"), { recursive: true });
      writeFileSync(join(targetDir, "bin", "node"), "");
    };
    const result = await stageNodeRuntime({ destDir, fetch, extract, sha256: () => NODE_LINUX_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(fetchCalls[0], NODE_LINUX_URL);
    assert.ok(existsSync(result.nodeBinPath));
    assert.match(NODE_LINUX_URL, new RegExp(NODE_VERSION.replace(/\./g, "\\.")));
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
