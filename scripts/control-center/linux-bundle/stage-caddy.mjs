import { createHash } from "node:crypto";
import { chmodSync } from "node:fs";
import { join } from "node:path";

export const CADDY_VERSION = "2.11.4";
export const CADDY_LINUX_URL = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz`;
export const CADDY_LINUX_SHA256 = "527fbf917c39189a1e3b31d34fa955601680b2d5c8055d2a87b8b9588dec7bb9";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function defaultExtract(tarballBytes, targetDir) {
  const { spawnSync } = await import("node:child_process");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(targetDir, { recursive: true });
  // Pipe the archive via stdin ("-f -") instead of writing it to a temp file
  // and passing that path as an argument: a Windows temp path's drive-letter
  // colon (C:\Users\...) makes some tar builds mis-parse it as a remote
  // host:file spec, and GNU tar's --force-local workaround for that isn't
  // supported by Windows' built-in bsdtar. Stdin sidesteps both.
  const result = spawnSync("tar", ["-xzf", "-", "-C", targetDir], { input: tarballBytes });
  if (result.status !== 0) throw new Error(`tar extraction failed: ${result.stderr}`);
}

export async function stageCaddyRuntime({ destDir, fetch = defaultFetch, extract = defaultExtract, sha256 = defaultSha256 } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageCaddyRuntime requires destDir.");
  const tarballBytes = await fetch(CADDY_LINUX_URL);
  const actualHash = sha256(tarballBytes);
  if (actualHash !== CADDY_LINUX_SHA256) throw new Error(`Caddy runtime checksum mismatch: expected ${CADDY_LINUX_SHA256}, got ${actualHash}`);
  await extract(tarballBytes, destDir);
  const caddyBinPath = join(destDir, "caddy");
  try { chmodSync(caddyBinPath, 0o755); } catch { /* extraction may already set the mode */ }
  return { ok: true, caddyBinPath };
}
