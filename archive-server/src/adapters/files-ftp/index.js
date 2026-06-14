// FTP/FTPS FileStore adapter — stores blobs on a remote FTP server, selected
// via FILE_STORE=ftp. Implements the same key→blob port as files-disk so the
// SPA contract (/api/files/*) is unchanged: downloads always proxy through the
// server, credentials never reach the browser.
//
// Env: FTP_HOST, FTP_PORT (21), FTP_USER, FTP_PASSWORD, FTP_SECURE (true=FTPS),
//      FTP_ROOT (base dir, default "/").
//
// Requires the `basic-ftp` package (archive-server dependency).
import { Readable, Writable } from "node:stream";

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

// Reject traversal / NUL the same way the disk adapter does, then join under root.
function resolveKey(root, key) {
  const clean = String(key || "").replace(/^\/+/, "");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) fail("Invalid file key.");
  const base = String(root || "/").replace(/\/+$/, "");
  return { clean, remote: `${base}/${clean}` };
}

async function blobToBuffer(blob) {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof blob.arrayBuffer === "function") return Buffer.from(await blob.arrayBuffer());
  return Buffer.alloc(0);
}

export function createFtpFileStore({
  host = process.env.FTP_HOST,
  port = Number(process.env.FTP_PORT || 21),
  user = process.env.FTP_USER,
  password = process.env.FTP_PASSWORD,
  secure = String(process.env.FTP_SECURE || "false").toLowerCase() === "true",
  root = process.env.FTP_ROOT || "/"
} = {}) {
  const configured = Boolean(host && user);

  // basic-ftp clients are not concurrency-safe, so open one per operation.
  async function withClient(run) {
    if (!configured) fail("FTP غير مهيأ: اضبط FTP_HOST و FTP_USER.", 503);
    const { Client } = await import("basic-ftp");
    const client = new Client();
    try {
      await client.access({ host, port, user, password, secure });
      return await run(client);
    } finally {
      client.close();
    }
  }

  return {
    describe() {
      return { kind: "ftp", label: "FTP", host: host || null, secure, configured, auth: "password" };
    },
    async putBlob(key, blob) {
      const { clean, remote } = resolveKey(root, key);
      const bytes = await blobToBuffer(blob);
      await withClient(async (client) => {
        const dir = remote.slice(0, remote.lastIndexOf("/")) || "/";
        await client.ensureDir(dir);
        await client.cd("/"); // ensureDir leaves CWD at the created dir
        await client.uploadFrom(Readable.from(bytes), remote);
      });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key) {
      const { remote } = resolveKey(root, key);
      return withClient(async (client) => {
        const chunks = [];
        const sink = new Writable({
          write(chunk, _enc, cb) {
            chunks.push(chunk);
            cb();
          }
        });
        try {
          await client.downloadTo(sink, remote);
        } catch {
          return null;
        }
        return Buffer.concat(chunks);
      });
    },
    async getUrl(key) {
      const { clean } = resolveKey(root, key);
      // SPA always downloads through the server proxy; FTP has no public URL.
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key) {
      const { remote } = resolveKey(root, key);
      await withClient(async (client) => {
        try {
          await client.remove(remote);
        } catch {
          /* already gone */
        }
      });
    },
    async list(prefix = "") {
      const cleanPrefix = String(prefix || "");
      return withClient(async (client) => {
        const base = String(root || "/").replace(/\/+$/, "");
        let entries = [];
        try {
          entries = await client.list(base);
        } catch {
          return [];
        }
        return entries
          .filter((entry) => entry.isFile)
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(cleanPrefix));
      });
    }
  };
}
