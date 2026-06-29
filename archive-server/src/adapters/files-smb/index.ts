// SMB/CIFS FileStore adapter — stores blobs on a Windows/Samba share, selected
// via FILE_STORE=smb. Same key→blob port as files-disk; the SPA only ever talks
// to /api/files/* so credentials never reach the browser.
//
// Env: SMB_SHARE (\\\\host\\share), SMB_DOMAIN, SMB_USERNAME, SMB_PASSWORD,
//      SMB_ROOT (sub-folder inside the share, default "").
//
// Requires the `@marsaud/smb2` package (archive-server dependency).

function fail(message: string, statusCode: number = 400): never {
  const error = new Error(message);
  (error as unknown as Record<string, unknown>).statusCode = statusCode;
  throw error;
}

interface ResolveKeyResult {
  clean: string;
  remote: string;
}

// SMB paths use backslashes. Reject traversal/NUL, strip leading slashes, then
// join under the optional root folder.
function resolveKey(root: string | undefined, key: string | number): ResolveKeyResult {
  const clean = String(key || "").replace(/^[\\/]+/, "");
  if (!clean || clean.includes("\0") || clean.split(/[\\/]/).includes("..")) fail("Invalid file key.");
  const base = String(root || "").replace(/[\\/]+$/, "");
  const joined = base ? `${base}/${clean}` : clean;
  return { clean, remote: joined.replace(/\//g, "\\") };
}

async function blobToBuffer(blob: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof (blob as Record<string, unknown>).arrayBuffer === "function") return Buffer.from(await ((blob as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>)());
  return Buffer.alloc(0);
}

interface SmbClient {
  disconnect(): void;
  mkdir(path: string): Promise<void>;
  writeFile(path: string, data: Buffer): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  unlink(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
}

interface BlobResult {
  key: string;
  url: string;
}

interface SmbOptions {
  share?: string;
  domain?: string;
  username?: string;
  password?: string;
  root?: string;
  [key: string]: unknown;
}

export function createSmbFileStore({
  share = process.env.SMB_SHARE,
  domain = process.env.SMB_DOMAIN || "WORKGROUP",
  username = process.env.SMB_USERNAME,
  password = process.env.SMB_PASSWORD,
  root = process.env.SMB_ROOT || ""
}: SmbOptions = {}) {
  const configured = Boolean(share && username);

  // @marsaud/smb2 holds a live connection; open one per operation and close it
  // to avoid leaking sockets across concurrent requests.
  async function withClient<T>(run: (client: SmbClient) => Promise<T>): Promise<T> {
    if (!configured) fail("SMB غير مهيأ: اضبط SMB_SHARE و SMB_USERNAME.", 503);
    const SMB2 = (await import("@marsaud/smb2")).default;
    const client = new SMB2({ share: share ?? "", domain, username: username ?? "", password: password ?? "", autoCloseTimeout: 0 });
    try {
      return await run(client as SmbClient);
    } finally {
      try {
        client.disconnect();
      } catch {
        /* already closed */
      }
    }
  }

  const call = (client: SmbClient, method: string, ...args: unknown[]): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const fn = (client as unknown as Record<string, unknown>)[method] as ((...a: unknown[]) => void);
      fn(...args, (err: unknown, data: unknown) => (err ? reject(err) : resolve(data)));
    });

  async function ensureDir(client: SmbClient, remote: string): Promise<void> {
    const dir = remote.slice(0, remote.lastIndexOf("\\"));
    if (!dir) return;
    const parts = dir.split("\\");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}\\${part}` : part;
      try {
        await call(client, "mkdir", current);
      } catch {
        /* exists */
      }
    }
  }

  return {
    describe() {
      return { kind: "smb", label: "SMB/CIFS", share: share || null as unknown as string | null, configured, auth: "password" };
    },
    async putBlob(key: string | number, blob: unknown): Promise<BlobResult> {
      const { clean, remote } = resolveKey(root, key);
      const bytes = await blobToBuffer(blob);
      await withClient(async (client) => {
        await ensureDir(client, remote);
        await call(client, "writeFile", remote, bytes);
      });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key: string | number): Promise<Buffer | null> {
      const { remote } = resolveKey(root, key);
      return withClient(async (client) => {
        try {
          return await call(client, "readFile", remote) as Buffer;
        } catch {
          return null;
        }
      });
    },
    async getUrl(key: string | number): Promise<string> {
      const { clean } = resolveKey(root, key);
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key: string | number): Promise<void> {
      const { remote } = resolveKey(root, key);
      await withClient(async (client) => {
        try {
          await call(client, "unlink", remote);
        } catch {
          /* already gone */
        }
      });
    },
    async list(prefix: string = ""): Promise<string[]> {
      const cleanPrefix = String(prefix || "");
      return withClient(async (client) => {
        const base = String(root || "").replace(/[\\/]+$/, "").replace(/\//g, "\\");
        let names: string[] = [];
        try {
          names = await call(client, "readdir", base || ".") as string[];
        } catch {
          return [];
        }
        return (names || []).filter((name) => name.startsWith(cleanPrefix));
      });
    }
  };
}
