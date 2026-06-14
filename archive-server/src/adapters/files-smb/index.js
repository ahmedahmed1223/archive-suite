// SMB/CIFS FileStore adapter — stores blobs on a Windows/Samba share, selected
// via FILE_STORE=smb. Same key→blob port as files-disk; the SPA only ever talks
// to /api/files/* so credentials never reach the browser.
//
// Env: SMB_SHARE (\\\\host\\share), SMB_DOMAIN, SMB_USERNAME, SMB_PASSWORD,
//      SMB_ROOT (sub-folder inside the share, default "").
//
// Requires the `@marsaud/smb2` package (archive-server dependency).
function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

// SMB paths use backslashes. Reject traversal/NUL, strip leading slashes, then
// join under the optional root folder.
function resolveKey(root, key) {
  const clean = String(key || "").replace(/^[\\/]+/, "");
  if (!clean || clean.includes("\0") || clean.split(/[\\/]/).includes("..")) fail("Invalid file key.");
  const base = String(root || "").replace(/[\\/]+$/, "");
  const joined = base ? `${base}/${clean}` : clean;
  return { clean, remote: joined.replace(/\//g, "\\") };
}

async function blobToBuffer(blob) {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof blob.arrayBuffer === "function") return Buffer.from(await blob.arrayBuffer());
  return Buffer.alloc(0);
}

export function createSmbFileStore({
  share = process.env.SMB_SHARE,
  domain = process.env.SMB_DOMAIN || "WORKGROUP",
  username = process.env.SMB_USERNAME,
  password = process.env.SMB_PASSWORD,
  root = process.env.SMB_ROOT || ""
} = {}) {
  const configured = Boolean(share && username);

  // @marsaud/smb2 holds a live connection; open one per operation and close it
  // to avoid leaking sockets across concurrent requests.
  async function withClient(run) {
    if (!configured) fail("SMB غير مهيأ: اضبط SMB_SHARE و SMB_USERNAME.", 503);
    const SMB2 = (await import("@marsaud/smb2")).default;
    const client = new SMB2({ share, domain, username, password, autoCloseTimeout: 0 });
    try {
      return await run(client);
    } finally {
      try {
        client.disconnect();
      } catch {
        /* already closed */
      }
    }
  }

  const call = (client, method, ...args) =>
    new Promise((resolve, reject) => {
      client[method](...args, (err, data) => (err ? reject(err) : resolve(data)));
    });

  async function ensureDir(client, remote) {
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
      return { kind: "smb", label: "SMB/CIFS", share: share || null, configured, auth: "password" };
    },
    async putBlob(key, blob) {
      const { clean, remote } = resolveKey(root, key);
      const bytes = await blobToBuffer(blob);
      await withClient(async (client) => {
        await ensureDir(client, remote);
        await call(client, "writeFile", remote, bytes);
      });
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key) {
      const { remote } = resolveKey(root, key);
      return withClient(async (client) => {
        try {
          return await call(client, "readFile", remote);
        } catch {
          return null;
        }
      });
    },
    async getUrl(key) {
      const { clean } = resolveKey(root, key);
      return `/api/files/${encodeURIComponent(clean)}`;
    },
    async remove(key) {
      const { remote } = resolveKey(root, key);
      await withClient(async (client) => {
        try {
          await call(client, "unlink", remote);
        } catch {
          /* already gone */
        }
      });
    },
    async list(prefix = "") {
      const cleanPrefix = String(prefix || "");
      return withClient(async (client) => {
        const base = String(root || "").replace(/[\\/]+$/, "").replace(/\//g, "\\");
        let names = [];
        try {
          names = await call(client, "readdir", base || ".");
        } catch {
          return [];
        }
        return (names || []).filter((name) => name.startsWith(cleanPrefix));
      });
    }
  };
}
