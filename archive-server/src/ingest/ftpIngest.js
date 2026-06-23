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

/**
 * Load the JSON manifest (set of already-ingested remote paths).
 * Returns a Set<string>.
 */
async function loadManifest(manifestPath) {
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
async function saveManifest(manifestPath, set) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify([...set], null, 2), "utf8");
}

/**
 * Pull new files from an FTP server into a local directory.
 *
 * @param {object} options
 * @param {string}   options.host
 * @param {number}   [options.port]           - default 21
 * @param {string}   options.user
 * @param {string}   options.password
 * @param {string}   [options.remotePath]     - remote directory to list (default "/")
 * @param {string}   options.localPath        - local directory to download files into
 * @param {boolean}  [options.secure]         - use FTPS (default false)
 * @param {string}   [options.manifestPath]   - path to the JSON manifest file
 * @returns {Promise<{ pulled: string[], skipped: number }>}
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
}) {
  if (!host || !user) {
    const err = new Error("FTP pull requires host and user");
    err.statusCode = 400;
    throw err;
  }
  if (!localPath) {
    const err = new Error("FTP pull requires localPath");
    err.statusCode = 400;
    throw err;
  }

  const { Client } = await import("basic-ftp");
  const client = new Client();

  try {
    await client.access({ host, port, user, password, secure });

    const ingested = await loadManifest(manifestPath);
    let entries;
    try {
      entries = await client.list(remotePath);
    } catch (err) {
      const e = new Error(`FTP list failed: ${err?.message}`);
      e.statusCode = 502;
      throw e;
    }

    const files = entries.filter((e) => e.isFile);
    const pulled = [];
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
