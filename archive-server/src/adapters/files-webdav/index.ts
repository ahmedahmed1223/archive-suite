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

interface WebDavClient {
  createDirectory(path: string, opts?: Record<string, unknown>): Promise<void>;
  putFileContents(path: string, data: Buffer | Uint8Array, opts?: Record<string, unknown>): Promise<boolean>;
  getFileContents(path: string, opts?: Record<string, unknown>): Promise<Buffer | null>;
  deleteFile(path: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  stat(path: string): Promise<{ type: string; size: number; lastmod?: string }>;
  getDirectoryContents(path: string): Promise<Array<{ type: string; basename: string; size: number }>>;
}

type ClientFactoryFn = (opts: Record<string, unknown>) => WebDavClient;

interface BlobResult {
  key: string;
  url: string;
}

interface StatResult {
  key: string;
  kind: "file" | "folder";
  size: number;
  modifiedAt: string | null;
}

interface WebDavOptions {
  url?: string;
  username?: string;
  password?: string;
  bearerToken?: string;
  root?: string;
  clientFactory?: ClientFactoryFn;
}

export function createWebDavFileStore({
  url = process.env.WEBDAV_URL,
  username = process.env.WEBDAV_USERNAME,
  password = process.env.WEBDAV_PASSWORD,
  bearerToken = process.env.WEBDAV_BEARER_TOKEN,
  root = process.env.WEBDAV_ROOT || "/",
  clientFactory
}: WebDavOptions = {}) {
  const configured = Boolean(url);

  async function getClient(): Promise<WebDavClient> {
    if (!configured) fail("WebDAV غير مهيأ: اضبط WEBDAV_URL.", 503);
    const options: Record<string, unknown> = bearerToken
      ? { headers: { Authorization: `Bearer ${bearerToken}` } }
      : username || password ? { username, password } : {};
    if (clientFactory) return clientFactory(options);
    const webdavModule = await import("webdav");
    const createClientFn = (webdavModule as any).createClient;
    return createClientFn(url as string, options) as WebDavClient;
  }

  async function ensureParent(client: WebDavClient, remote: string): Promise<void> {
    const parent = remote.slice(0, remote.lastIndexOf("/")) || "/";
    await client.createDirectory(parent, { recursive: true });
  }

  return {
    describe() {
      return { kind: "webdav", label: "WebDAV", url: url || null, root, configured, auth: bearerToken ? "bearer" : username ? "password" : "none" };
    },
    async putBlob(key: string | number, blob: unknown): Promise<BlobResult> {
      const { clean, remote } = joinRemote(root, key);
      const client = await getClient();
      await ensureParent(client, remote);
      await client.putFileContents(remote, await blobToBuffer(blob), { overwrite: true });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key: string | number): Promise<Buffer | null> {
      const { remote } = joinRemote(root, key);
      const client = await getClient();
      try {
        const value = await client.getFileContents(remote, { format: "binary" });
        return value == null ? null : Buffer.from(value);
      } catch {
        return null;
      }
    },
    async getUrl(key: string | number): Promise<string> {
      const { clean } = joinRemote(root, key);
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key: string | number): Promise<void> {
      const { remote } = joinRemote(root, key);
      const client = await getClient();
      try { await client.deleteFile(remote); } catch { /* idempotent delete */ }
    },
    async createFolder(key: string | number): Promise<BlobResult & { kind: string }> {
      const { clean, remote } = joinRemote(root, key);
      const client = await getClient();
      await client.createDirectory(remote, { recursive: true });
      return { key: clean, kind: "folder", url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async copy(source: string | number, destination: string | number): Promise<BlobResult> {
      const from = joinRemote(root, source);
      const to = joinRemote(root, destination);
      const client = await getClient();
      await ensureParent(client, to.remote);
      await client.copyFile(from.remote, to.remote);
      return { key: to.clean, url: `/api/files/${encodeURIComponent(to.clean)}` };
    },
    async move(source: string | number, destination: string | number): Promise<BlobResult> {
      const from = joinRemote(root, source);
      const to = joinRemote(root, destination);
      const client = await getClient();
      await ensureParent(client, to.remote);
      await client.moveFile(from.remote, to.remote);
      return { key: to.clean, url: `/api/files/${encodeURIComponent(to.clean)}` };
    },
    async stat(key: string | number): Promise<StatResult | null> {
      const { clean, remote } = joinRemote(root, key);
      const client = await getClient();
      try {
        const value = await client.stat(remote);
        return { key: clean, kind: value?.type === "directory" ? "folder" : "file", size: value?.size || 0, modifiedAt: value?.lastmod || null };
      } catch {
        return null;
      }
    },
    async list(prefix: string = ""): Promise<string[]> {
      const { clean, remote } = joinRemote(root, prefix, { allowEmpty: true });
      const client = await getClient();
      let entries: Array<Record<string, unknown>> = [];
      try { entries = await client.getDirectoryContents(remote); } catch { return []; }
      return (entries || [])
        .filter((entry) => entry.type !== "directory")
        .map((entry) => clean ? `${clean}/${entry.basename}` : entry.basename as string);
    }
  };
}
