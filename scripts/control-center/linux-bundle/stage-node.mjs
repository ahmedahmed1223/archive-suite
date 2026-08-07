import { createHash } from "node:crypto";
import { chmodSync } from "node:fs";
import { join } from "node:path";

export const NODE_VERSION = "26.5.0";
export const NODE_LINUX_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz`;
export const NODE_LINUX_SHA256 = "9f619528f1db5ddc41dccf54211066fb42228d69a156733c69cb9d6cc92e358c";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(tarballBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const os = await import("node:os");
  mkdirSync(targetDir, { recursive: true });
  const tmpTar = join(os.tmpdir(), `node-runtime-${Date.now()}.tar.xz`);
  writeFileSync(tmpTar, tarballBytes);
  const result = spawnSync("tar", ["-xJf", tmpTar, "-C", targetDir, "--strip-components=1"]);
  if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr}`);
}

export async function stageNodeRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageNodeRuntime requires destDir.");
  const tarballBytes = await fetch(NODE_LINUX_URL);
  const actualHash = sha256(tarballBytes);
  if (actualHash !== NODE_LINUX_SHA256) throw new Error(`Node runtime checksum mismatch: expected ${NODE_LINUX_SHA256}, got ${actualHash}`);
  await extract(tarballBytes, destDir);
  const nodeBinPath = join(destDir, "bin", "node");
  try { chmodSync(nodeBinPath, 0o755); } catch { /* extraction may already set the mode */ }
  return { ok: true, nodeBinPath };
}
