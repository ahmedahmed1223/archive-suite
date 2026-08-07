// windows-host-effects.mjs's serviceControl already assumes
// services\<id>.exe is a WinSW copy per service; WinSW reads its config from
// a same-named .xml, which serviceControl.install() already writes.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WINDOWS_SERVICES } from "../windows-services.mjs";

export const WINSW_VERSION = "3.0.0-alpha.11";
export const WINSW_URL = `https://github.com/winsw/winsw/releases/download/v${WINSW_VERSION}/WinSW-x64.exe`;
// Verified against the downloaded artifact 2026-08-07.
export const WINSW_SHA256 = "a2daa6a33a9c2b791ae31d9092e7935c339d1e03e89bfb747618ce2f4e819e20";

function defaultSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function defaultFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function stageWinswCopies({ destDir, fetch = defaultFetch, sha256 = defaultSha256, services = WINDOWS_SERVICES } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageWinswCopies requires destDir.");
  const bytes = await fetch(WINSW_URL);
  const actualHash = sha256(bytes);
  if (actualHash !== WINSW_SHA256) throw new Error(`WinSW checksum mismatch: expected ${WINSW_SHA256}, got ${actualHash}`);
  mkdirSync(destDir, { recursive: true });
  const exePaths = services.map((service) => {
    const path = join(destDir, `${service.id}.exe`);
    writeFileSync(path, bytes);
    return path;
  });
  return { ok: true, exePaths };
}
