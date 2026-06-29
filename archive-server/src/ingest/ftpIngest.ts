/**
 * FTP ingest — pulls new files from a remote FTP server.
 *
 * Uses the `basic-ftp` package already in archive-server/package.json.
 * Tracks already-ingested remote paths in a JSON manifest at
 * archive-server/var/ingest/ftp-manifest.json to avoid duplicate pulls.
 *
 * Credentials are accepted per-request, never read from env here —
 * they are supplied by the caller (route handler, test, etc.).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

const DEFAULT_MANIFEST_PATH = join(
  new URL("../../../var/ingest/ftp-manifest.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
);

// ── Type definitions ──────────────────────────────────────────────────────────

interface FtpOptions {
  host: string;
  port?: number;
  user: string;
  password: string;
  remotePath?: string;
  localPath: string;
  secure?: boolean;
  manifestPath?: string;
}

interface PullResult {
  pulled: string[];
  skipped: number;
}

/**
 * Load the JSON manifest (set of already-ingested remote paths).
 * Returns a Set<string>.
 */
async function loadManifest(manifestPath: string): Promise<Set<string>> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Persist the manifest (Set → JSON array).
 */
async function saveManifest(manifestPath: string, set: Set<string>): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify([...set], null, 2), "utf8");
}

/**
 * Pull new files from an FTP server into a local directory.
 */
export async function pullFromFtp({
  host,
  port = 21,
  user,
  password,
  remotePath = "/",
  localPath,
  secure = false,
  manifestPath = DEFAULT_MANIFEST_PATH,
}: FtpOptions): Promise<PullResult> {
  if (!host || !user) {
    const err = new Error("FTP pull requires host and user");
    (err as any).statusCode = 400;
    throw err;
  }
  if (!localPath) {
    const err = new Error("FTP pull requires localPath");
    (err as any).statusCode = 400;
    throw err;
  }

  const { Client } = await import("basic-ftp");
  const client = new (Client as any)();

  try {
    await client.access({ host, port, user, password, secure });

    const ingested = await loadManifest(manifestPath);
    let entries;
    try {
      entries = await client.list(remotePath);
    } catch (err) {
      const e = new Error(`FTP list failed: ${(err as any)?.message}`);
      (e as any).statusCode = 502;
      throw e;
    }

    const files = entries.filter((e: any) => e.isFile);
    const pulled: string[] = [];
    let skipped = 0;

    await mkdir(localPath, { recursive: true });

    for (const entry of files) {
      const remoteKey = `${remotePath.replace(/\/$/, "")}/${entry.name}`;
      if (ingested.has(remoteKey)) {
        skipped += 1;
        continue;
      }

      const dest = join(localPath, entry.name);
      // Download via a writable stream — no full-file buffer.
      const ws = createWriteStream(dest);
      await client.downloadTo(ws, remoteKey);

      ingested.add(remoteKey);
      pulled.push(dest);
    }

    await saveManifest(manifestPath, ingested);
    return { pulled, skipped };
  } finally {
    client.close();
  }
}
