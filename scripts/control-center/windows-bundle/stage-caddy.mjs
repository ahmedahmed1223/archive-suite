import { createHash } from "node:crypto";
import { join } from "node:path";

export const CADDY_VERSION = "2.11.4";
export const CADDY_WINDOWS_URL = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_windows_amd64.zip`;
// Verified against the downloaded artifact 2026-08-07.
export const CADDY_WINDOWS_SHA256 = "1708333f79e274c7697285afe6d592ab39314e0b131e9ec6bea08ad27df62ebf";

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
  const tmpZip = join(os.tmpdir(), `caddy-runtime-${Date.now()}.zip`);
  writeFileSync(tmpZip, zipBytes);
  const result = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Path '${tmpZip}' -DestinationPath '${targetDir}' -Force`]);
  if (result.status !== 0) throw new Error(`Expand-Archive failed: ${result.stderr}`);
}

export async function stageCaddyRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageCaddyRuntime requires destDir.");
  const zipBytes = await fetch(CADDY_WINDOWS_URL);
  const actualHash = sha256(zipBytes);
  if (actualHash !== CADDY_WINDOWS_SHA256) throw new Error(`Caddy runtime checksum mismatch: expected ${CADDY_WINDOWS_SHA256}, got ${actualHash}`);
  await extract(zipBytes, destDir);
  return { ok: true, caddyExePath: join(destDir, "caddy.exe") };
}
