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

export function createWebDavFileStore({
  url = process.env.WEBDAV_URL,
  username = process.env.WEBDAV_USERNAME,
  password = process.env.WEBDAV_PASSWORD,
  bearerToken = process.env.WEBDAV_BEARER_TOKEN,
  root = process.env.WEBDAV_ROOT || "/",
  clientFactory
} = {}) {
  const configured = Boolean(url);

  async function getClient() {
    if (!configured) fail("WebDAV غير مهيأ: اضبط WEBDAV_URL.", 503);
    const options = bearerToken
      ? { headers: { Authorization: `Bearer ${bearerToken}` } }
      : username || password ? { username, password } : {};
    return clientFactory ? clientFactory({ url, ...options }) : (await import("webdav")).createClient(url, options);
  }

  async function ensureParent(client, remote) {
    const parent = remote.slice(0, remote.lastIndexOf("/")) || "/";
    await client.createDirectory(parent, { recursive: true });
  }

  return {
    describe() {
      return { kind: "webdav", label: "WebDAV", url: url || null, root, configured, auth: bearerToken ? "bearer" : username ? "password" : "none" };
    },
    async putBlob(key, blob) {
      const { clean, remote } = joinRemote(root, key);
      const client = await getClient();
      await ensureParent(client, remote);
      await client.putFileContents(remote, await blobToBuffer(blob), { overwrite: true });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key) {
      const { remote } = joinRemote(root, key);
      const client = await getClient();
      try {
        const value = await client.getFileContents(remote, { format: "binary" });
        return value == null ? null : Buffer.from(value);
      } catch {
        return null;
      }
    },
    async getUrl(key) {
      const { clean } = joinRemote(root, key);
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key) {
      const { remote } = joinRemote(root, key);
      const client = await getClient();
      try { await client.deleteFile(remote); } catch { /* idempotent delete */ }
    },
    async createFolder(key) {
      const { clean, remote } = joinRemote(root, key);
      const client = await getClient();
      await client.createDirectory(remote, { recursive: true });
      return { key: clean, kind: "folder" };
    },
    async copy(source, destination) {
      const from = joinRemote(root, source);
      const to = joinRemote(root, destination);
      const client = await getClient();
      await ensureParent(client, to.remote);
      await client.copyFile(from.remote, to.remote);
      return { key: to.clean, url: `/api/files/${encodeURIComponent(to.clean)}` };
    },
    async move(source, destination) {
      const from = joinRemote(root, source);
      const to = joinRemote(root, destination);
      const client = await getClient();
      await ensureParent(client, to.remote);
      await client.moveFile(from.remote, to.remote);
      return { key: to.clean, url: `/api/files/${encodeURIComponent(to.clean)}` };
    },
    async stat(key) {
      const { clean, remote } = joinRemote(root, key);
      const client = await getClient();
      try {
        const value = await client.stat(remote);
        return { key: clean, kind: value?.type === "directory" ? "folder" : "file", size: value?.size || 0, modifiedAt: value?.lastmod || null };
      } catch {
        return null;
      }
    },
    async list(prefix = "") {
      const { clean, remote } = joinRemote(root, prefix, { allowEmpty: true });
      const client = await getClient();
      let entries;
      try { entries = await client.getDirectoryContents(remote); } catch { return []; }
      return (entries || [])
        .filter((entry) => entry.type !== "directory")
        .map((entry) => clean ? `${clean}/${entry.basename}` : entry.basename);
    }
  };
}
