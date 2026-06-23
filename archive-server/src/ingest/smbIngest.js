/**
 * SMB ingest — pulls new files from a Windows/Samba share.
 *
 * Uses the `@marsaud/smb2` package already in archive-server/package.json.
 * Tracks already-ingested remote paths in a JSON manifest at
 * archive-server/var/ingest/smb-manifest.json to avoid duplicate pulls.
 *
 * Credentials are accepted per-request, never read from env here.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname } from "node:path";

const DEFAULT_MANIFEST_PATH = join(
  new URL("../../../var/ingest/smb-manifest.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
);

async function loadManifest(manifestPath) {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveManifest(manifestPath, set) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify([...set], null, 2), "utf8");
}

/** Promisify a callback-style @marsaud/smb2 call. */
function call(client, method, ...args) {
  return new Promise((resolve, reject) => {
    client[method](...args, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/**
 * Pull new files from an SMB share into a local directory.
 *
 * @param {object} options
 * @param {string}   options.share          - UNC path e.g. "\\\\host\\share"
 * @param {string}   [options.path]         - sub-folder inside the share (default "")
 * @param {string}   options.user
 * @param {string}   options.password
 * @param {string}   [options.domain]       - default "WORKGROUP"
 * @param {string}   options.localPath      - local directory to download files into
 * @param {string}   [options.manifestPath]
 * @returns {Promise<{ pulled: string[], skipped: number }>}
 */
export async function pullFromSmb({
  share,
  path: remotePath = "",
  user,
  password,
  domain = "WORKGROUP",
  localPath,
  manifestPath = DEFAULT_MANIFEST_PATH,
}) {
  if (!share || !user) {
    const err = new Error("SMB pull requires share and user");
    err.statusCode = 400;
    throw err;
  }
  if (!localPath) {
    const err = new Error("SMB pull requires localPath");
    err.statusCode = 400;
    throw err;
  }

  const SMB2 = (await import("@marsaud/smb2")).default;
  const client = new SMB2({ share, domain, username: user, password, autoCloseTimeout: 0 });

  try {
    const ingested = await loadManifest(manifestPath);

    let names;
    try {
      names = await call(client, "readdir", remotePath || ".");
    } catch (err) {
      const e = new Error(`SMB readdir failed: ${err?.message}`);
      e.statusCode = 502;
      throw e;
    }

    await mkdir(localPath, { recursive: true });

    const pulled = [];
    let skipped = 0;

    for (const name of names || []) {
      const remoteKey = remotePath ? `${remotePath}\\${name}` : name;

      if (ingested.has(remoteKey)) {
        skipped += 1;
        continue;
      }

      const dest = join(localPath, name);
      // Read via SMB then write locally — @marsaud/smb2 streams internally.
      let data;
      try {
        data = await call(client, "readFile", remoteKey);
      } catch {
        // Skip entries that can't be read (could be sub-directories, etc.)
        continue;
      }

      // Write in chunks via a writable stream to stay memory-efficient for
      // large files; @marsaud/smb2 already returns a Buffer here but we avoid
      // a second copy by piping through a write stream.
      await new Promise((resolve, reject) => {
        const ws = createWriteStream(dest);
        ws.on("error", reject);
        ws.on("finish", resolve);
        ws.end(data);
      });

      ingested.add(remoteKey);
      pulled.push(dest);
    }

    await saveManifest(manifestPath, ingested);
    return { pulled, skipped };
  } finally {
    try { client.disconnect(); } catch { /* already closed */ }
  }
}
