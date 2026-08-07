import { createHash } from "node:crypto";
import { join } from "node:path";

export const NODE_VERSION = "26.5.0";
export const NODE_WINDOWS_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
// From https://nodejs.org/dist/v26.5.0/SHASUMS256.txt (verified 2026-08-07).
export const NODE_WINDOWS_SHA256 = "d3b2277dbcccfdf24ef6302928f64f484cff1d77a6d3caa3a28f4d20ce9158f6";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(zipBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const os = await import("node:os");
  mkdirSync(targetDir, { recursive: true });
  const tmpZip = join(os.tmpdir(), `node-runtime-${Date.now()}.zip`);
  writeFileSync(tmpZip, zipBytes);
  const result = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Path '${tmpZip}' -DestinationPath '${targetDir}' -Force`]);
  if (result.status !== 0) throw new Error(`Expand-Archive failed: ${result.stderr}`);
}

export async function stageNodeRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageNodeRuntime requires destDir.");
  const zipBytes = await fetch(NODE_WINDOWS_URL);
  const actualHash = sha256(zipBytes);
  if (actualHash !== NODE_WINDOWS_SHA256) throw new Error(`Node runtime checksum mismatch: expected ${NODE_WINDOWS_SHA256}, got ${actualHash}`);
  await extract(zipBytes, destDir);
  return { ok: true, nodeExePath: join(destDir, `node-v${NODE_VERSION}-win-x64`, "node.exe") };
}
