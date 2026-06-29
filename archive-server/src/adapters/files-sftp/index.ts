import { normalizeFileKey } from "../../files/fileStoreOperations.js";

function fail(message: string, statusCode: number = 400): never {
  const error = new Error(message);
  (error as unknown as Record<string, unknown>).statusCode = statusCode;
  throw error;
}

interface RemoteKeyResult {
  clean: string;
  remote: string;
}

function joinRemote(root: string | undefined, key: string | number, { allowEmpty = false }: { allowEmpty?: boolean } = {}): RemoteKeyResult {
  const clean = normalizeFileKey(String(key), { allowEmpty });
  const base = `/${String(root || "/").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}`.replace(/\/$/, "");
  return { clean, remote: clean ? `${base || ""}/${clean}` || "/" : base || "/" };
}

async function blobToBuffer(blob: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof (blob as Record<string, unknown>).arrayBuffer === "function") return Buffer.from(await ((blob as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>)());
  return Buffer.alloc(0);
}

interface SftpClient {
  connect(opts: Record<string, unknown>): Promise<void>;
  end(): Promise<void>;
  mkdir(path: string, recursive: boolean): Promise<void>;
  put(data: Buffer, remote: string): Promise<void>;
  get(remote: string): Promise<Buffer | null>;
  delete(remote: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  stat(remote: string): Promise<{ size: number; modifyTime: number; isDirectory: boolean }>;
  list(path: string): Promise<Array<{ name: string; type: string; size: number; modifyTime: number }>>;
}

interface SftpFactoryFn {
  (): Promise<SftpClient>;
}

interface BlobResult {
  key: string;
  url: string;
}

interface StatResult {
  key: string;
  kind: "file" | "folder";
  size: number;
  modifiedAt: number | null;
}

interface SftpOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  root?: string;
  clientFactory?: SftpFactoryFn;
}

export function createSftpFileStore({
  host = process.env.SFTP_HOST,
  port = Number(process.env.SFTP_PORT || 22),
  username = process.env.SFTP_USERNAME,
  password = process.env.SFTP_PASSWORD,
  privateKey = process.env.SFTP_PRIVATE_KEY,
  passphrase = process.env.SFTP_PASSPHRASE,
  root = process.env.SFTP_ROOT || "/",
  clientFactory
}: SftpOptions = {}) {
  const configured = Boolean(host && username && (password || privateKey));

  async function withClient<T>(run: (client: SftpClient) => Promise<T>): Promise<T> {
    if (!configured) fail("SFTP غير مهيأ: اضبط الخادم واسم المستخدم وطريقة المصادقة.", 503);
    const client: SftpClient = clientFactory
      ? await clientFactory()
      : new ((await import("ssh2-sftp-client")).default as any)();
    try {
      await client.connect({ host, port, username, password, privateKey, passphrase });
      return await run(client);
    } finally {
      try { await client.end(); } catch { /* connection was already closed */ }
    }
  }

  async function ensureParent(client: SftpClient, remote: string): Promise<void> {
    const parent = remote.slice(0, remote.lastIndexOf("/")) || "/";
    await client.mkdir(parent, true);
  }

  return {
    describe() {
      return { kind: "sftp", label: "SFTP / SSH", host: host || null, port, root, configured, auth: privateKey ? "key" : "password" };
    },
    async putBlob(key: string | number, blob: unknown): Promise<BlobResult> {
      const { clean, remote } = joinRemote(root, key);
      const bytes = await blobToBuffer(blob);
      await withClient(async (client) => {
        await ensureParent(client, remote);
        await client.put(bytes, remote);
      });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key: string | number): Promise<Buffer | null> {
      const { remote } = joinRemote(root, key);
      return withClient(async (client) => {
        try {
          const value = await client.get(remote);
          return value == null ? null : Buffer.from(value);
        } catch {
          return null;
        }
      });
    },
    async getUrl(key: string | number): Promise<string> {
      const { clean } = joinRemote(root, key);
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key: string | number): Promise<void> {
      const { remote } = joinRemote(root, key);
      await withClient(async (client) => {
        try { await client.delete(remote); } catch { /* idempotent delete */ }
      });
    },
    async createFolder(key: string | number): Promise<BlobResult & { kind: string }> {
      const { clean, remote } = joinRemote(root, key);
      await withClient((client) => client.mkdir(remote, true));
      return { key: clean, kind: "folder", url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async move(source: string | number, destination: string | number): Promise<BlobResult> {
      const from = joinRemote(root, source);
      const to = joinRemote(root, destination);
      await withClient(async (client) => {
        await ensureParent(client, to.remote);
        await client.rename(from.remote, to.remote);
      });
      return { key: to.clean, url: `/api/files/${encodeURIComponent(to.clean)}` };
    },
    async stat(key: string | number): Promise<StatResult | null> {
      const { clean, remote } = joinRemote(root, key);
      return withClient(async (client) => {
        try {
          const value = await client.stat(remote);
          return { key: clean, kind: (value?.isDirectory) ? "folder" : "file", size: value?.size || 0, modifiedAt: value?.modifyTime || null };
        } catch {
          return null;
        }
      });
    },
    async list(prefix: string = ""): Promise<string[]> {
      const { clean, remote } = joinRemote(root, prefix, { allowEmpty: true });
      return withClient(async (client) => {
        let entries: Array<Record<string, unknown>> = [];
        try { entries = await client.list(remote); } catch { return []; }
        return ((entries || []) as Array<Record<string, unknown>>)
          .filter((entry) => entry.type !== "d")
          .map((entry) => (entry.name as string))
          .map((name) => clean ? `${clean}/${name}` : name);
      });
    }
  };
}
