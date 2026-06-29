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

function fail(message: string, statusCode: number = 400): never {
  const error = new Error(message);
  (error as unknown as Record<string, unknown>).statusCode = statusCode;
  throw error;
}

interface ResolveKeyResult {
  clean: string;
  remote: string;
}

// Reject traversal / NUL the same way the disk adapter does, then join under root.
function resolveKey(root: string | undefined, key: string | number): ResolveKeyResult {
  const clean = String(key || "").replace(/^\/+/, "");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) fail("Invalid file key.");
  const base = String(root || "/").replace(/\/+$/, "");
  return { clean, remote: `${base}/${clean}` };
}

async function blobToBuffer(blob: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof (blob as Record<string, unknown>).arrayBuffer === "function") return Buffer.from(await ((blob as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>)());
  return Buffer.alloc(0);
}

interface FtpClient {
  access(opts: Record<string, unknown>): Promise<void>;
  close(): void;
  ensureDir(path: string): Promise<void>;
  cd(path: string): Promise<void>;
  uploadFrom(stream: Readable, remote: string): Promise<void>;
  downloadTo(stream: Writable, remote: string): Promise<void>;
  remove(remote: string): Promise<void>;
  list(path: string): Promise<unknown[]>;
}

interface BlobResult {
  key: string;
  url: string;
}

export function createFtpFileStore({
  host = process.env.FTP_HOST,
  port = Number(process.env.FTP_PORT || 21),
  user = process.env.FTP_USER,
  password = process.env.FTP_PASSWORD,
  secure = String(process.env.FTP_SECURE || "false").toLowerCase() === "true",
  root = process.env.FTP_ROOT || "/"
}: Record<string, string | number | boolean | undefined> = {}) {
  const configured = Boolean(host && user);

  // basic-ftp clients are not concurrency-safe, so open one per operation.
  async function withClient<T>(run: (client: FtpClient) => Promise<T>): Promise<T> {
    if (!configured) fail("FTP غير مهيأ: اضبط FTP_HOST و FTP_USER.", 503);
    const basicFtp = await import("basic-ftp");
    const ClientClass = (basicFtp as unknown as Record<string, unknown>).Client as new () => FtpClient;
    const client = new ClientClass();
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
    async putBlob(key: string | number, blob: unknown): Promise<BlobResult> {
      const { clean, remote } = resolveKey(root as string | undefined, key);
      const bytes = await blobToBuffer(blob);
      await withClient(async (client) => {
        const dir = remote.slice(0, remote.lastIndexOf("/")) || "/";
        await client.ensureDir(dir);
        await client.cd("/"); // ensureDir leaves CWD at the created dir
        await client.uploadFrom(Readable.from(bytes), remote);
      });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key: string | number): Promise<Buffer | null> {
      const { remote } = resolveKey(root as string | undefined, key);
      return withClient(async (client) => {
        const chunks: Buffer[] = [];
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
    async getUrl(key: string | number): Promise<string> {
      const { clean } = resolveKey(root as string | undefined, key);
      // SPA always downloads through the server proxy; FTP has no public URL.
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key: string | number): Promise<void> {
      const { remote } = resolveKey(root as string | undefined, key);
      await withClient(async (client) => {
        try {
          await client.remove(remote);
        } catch {
          /* already gone */
        }
      });
    },
    async list(prefix: string = ""): Promise<string[]> {
      const cleanPrefix = String(prefix || "");
      return withClient(async (client) => {
        const base = String(root || "/").replace(/\/+$/, "");
        let entries: unknown[] = [];
        try {
          entries = await client.list(base);
        } catch {
          return [];
        }
        return (entries || [])
          .filter((entry) => (entry as Record<string, unknown>).isFile)
          .map((entry) => (entry as Record<string, unknown>).name as string)
          .filter((name) => name.startsWith(cleanPrefix));
      });
    }
  };
}
