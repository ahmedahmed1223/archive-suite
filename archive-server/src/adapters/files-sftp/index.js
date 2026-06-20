import { normalizeFileKey } from "../../files/fileStoreOperations.js";

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function joinRemote(root, key, { allowEmpty = false } = {}) {
  const clean = normalizeFileKey(key, { allowEmpty });
  const base = `/${String(root || "/").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}`.replace(/\/$/, "");
  return { clean, remote: clean ? `${base || ""}/${clean}` || "/" : base || "/" };
}

async function blobToBuffer(blob) {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof blob.arrayBuffer === "function") return Buffer.from(await blob.arrayBuffer());
  return Buffer.alloc(0);
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
} = {}) {
  const configured = Boolean(host && username && (password || privateKey));

  async function withClient(run) {
    if (!configured) fail("SFTP غير مهيأ: اضبط الخادم واسم المستخدم وطريقة المصادقة.", 503);
    const client = clientFactory
      ? await clientFactory()
      : new (await import("ssh2-sftp-client")).default();
    try {
      await client.connect({ host, port, username, password, privateKey, passphrase });
      return await run(client);
    } finally {
      try { await client.end(); } catch { /* connection was already closed */ }
    }
  }

  async function ensureParent(client, remote) {
    const parent = remote.slice(0, remote.lastIndexOf("/")) || "/";
    await client.mkdir(parent, true);
  }

  return {
    describe() {
      return { kind: "sftp", label: "SFTP / SSH", host: host || null, port, root, configured, auth: privateKey ? "key" : "password" };
    },
    async putBlob(key, blob) {
      const { clean, remote } = joinRemote(root, key);
      const bytes = await blobToBuffer(blob);
      await withClient(async (client) => {
        await ensureParent(client, remote);
        await client.put(bytes, remote);
      });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key) {
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
    async getUrl(key) {
      const { clean } = joinRemote(root, key);
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key) {
      const { remote } = joinRemote(root, key);
      await withClient(async (client) => {
        try { await client.delete(remote); } catch { /* idempotent delete */ }
      });
    },
    async createFolder(key) {
      const { clean, remote } = joinRemote(root, key);
      await withClient((client) => client.mkdir(remote, true));
      return { key: clean, kind: "folder" };
    },
    async move(source, destination) {
      const from = joinRemote(root, source);
      const to = joinRemote(root, destination);
      await withClient(async (client) => {
        await ensureParent(client, to.remote);
        await client.rename(from.remote, to.remote);
      });
      return { key: to.clean, url: `/api/files/${encodeURIComponent(to.clean)}` };
    },
    async stat(key) {
      const { clean, remote } = joinRemote(root, key);
      return withClient(async (client) => {
        try {
          const value = await client.stat(remote);
          return { key: clean, kind: value?.isDirectory ? "folder" : "file", size: value?.size || 0, modifiedAt: value?.modifyTime || null };
        } catch {
          return null;
        }
      });
    },
    async list(prefix = "") {
      const { clean, remote } = joinRemote(root, prefix, { allowEmpty: true });
      return withClient(async (client) => {
        let entries;
        try { entries = await client.list(remote); } catch { return []; }
        return (entries || [])
          .filter((entry) => entry.type !== "d")
          .map((entry) => clean ? `${clean}/${entry.name}` : entry.name);
      });
    }
  };
}
