import { Readable } from "node:stream";
import { drive as driveApi } from "@googleapis/drive";
import { JWT } from "google-auth-library";

// Google Drive FileStore adapter — implements the @archive/core FileStore port
// against a single Drive folder, selected via FILE_STORE=gdrive.
//
// Drive is file-ID based, not path based, so we map the FileStore key to the
// file's `name` (Drive names are arbitrary strings) inside one configured parent
// folder: key "thumbs/a.jpg" → a file named "thumbs/a.jpg" in GDRIVE_FOLDER_ID.
// Auth is a service account (server-side); the SPA keeps talking to /api/files/*.
// The drive client is injectable so the adapter is unit-tested without network.

const SCOPES = ["https://www.googleapis.com/auth/drive"];

class DriveFileError extends Error {
  constructor(message, { statusCode = 502 } = {}) {
    super(message);
    this.name = "DriveFileError";
    this.statusCode = statusCode;
  }
}

/** Map a FileStore key (+ optional prefix) to a Drive file name (traversal-safe). */
export function driveFileName(prefix, key) {
  const clean = String(key || "").replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new DriveFileError("Invalid file key.", { statusCode: 400 });
  }
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  return base ? `${base}/${clean}` : clean;
}

/** Strip the configured prefix off a Drive file name → relative FileStore key. */
export function stripDrivePrefix(prefix, name) {
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  const full = String(name || "");
  if (!base) return full;
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full;
}

/** Escape a value for use inside a Drive `q` query string literal. */
function escapeQuery(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function toBytes(blob) {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof blob.arrayBuffer === "function") return Buffer.from(await blob.arrayBuffer());
  return Buffer.alloc(0);
}

function parseCredentials(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function buildDriveClient({ credentials }) {
  const creds = parseCredentials(credentials);
  if (!creds?.client_email || !creds?.private_key) {
    throw new Error("Google Drive file store needs GDRIVE_CREDENTIALS (service-account JSON).");
  }
  const auth = new JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES });
  return driveApi({ version: "v3", auth });
}

export function createGoogleDriveFileStore({
  driveClient,
  folderId = process.env.GDRIVE_FOLDER_ID,
  credentials = process.env.GDRIVE_CREDENTIALS,
  prefix = process.env.GDRIVE_PREFIX || ""
} = {}) {
  if (!folderId) throw new Error("Google Drive file store needs GDRIVE_FOLDER_ID.");
  const drive = driveClient || buildDriveClient({ credentials });

  async function findFileId(name) {
    const q = `'${escapeQuery(folderId)}' in parents and name='${escapeQuery(name)}' and trashed=false`;
    const res = await drive.files.list({ q, fields: "files(id,name)", pageSize: 1, spaces: "drive", supportsAllDrives: true, includeItemsFromAllDrives: true });
    return res?.data?.files?.[0]?.id || null;
  }

  return {
    describe() {
      return {
        kind: "gdrive",
        label: "Google Drive",
        rootPath: folderId,
        prefix,
        configured: Boolean(folderId),
        auth: driveClient ? "injected-client" : "service-account"
      };
    },
    async putBlob(key, blob, meta = {}) {
      const name = driveFileName(prefix, key);
      const bytes = await toBytes(blob);
      const mimeType = meta.contentType || meta.ContentType || "application/octet-stream";
      const media = { mimeType, body: Readable.from(bytes) };
      const existing = await findFileId(name);
      if (existing) {
        await drive.files.update({ fileId: existing, media, supportsAllDrives: true });
      } else {
        await drive.files.create({ requestBody: { name, parents: [folderId] }, media, fields: "id", supportsAllDrives: true });
      }
      const clean = String(key || "").replace(/^[/\\]+/, "");
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },

    async getBlob(key) {
      const name = driveFileName(prefix, key);
      const id = await findFileId(name);
      if (!id) return null;
      const res = await drive.files.get({ fileId: id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
      const data = res?.data;
      if (data == null) return null;
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof ArrayBuffer) return Buffer.from(data);
      if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      return Buffer.from(data); // string fallback
    },

    // Drive has no stable anonymous URL without explicit sharing; downloads flow
    // through the server (getBlob). Return null so callers use that path.
    async getUrl() {
      return null;
    },

    async remove(key) {
      const name = driveFileName(prefix, key);
      const id = await findFileId(name);
      if (!id) return; // idempotent
      await drive.files.delete({ fileId: id, supportsAllDrives: true });
    },

    async list(listPrefix = "") {
      const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
      const userPrefix = String(listPrefix || "").replace(/^[/\\]+/, "");
      const wantPrefix = [base, userPrefix].filter(Boolean).join("/");
      const q = `'${escapeQuery(folderId)}' in parents and trashed=false`;
      const keys = [];
      let pageToken;
      for (let guard = 0; guard < 10_000; guard += 1) {
        const res = await drive.files.list({
          q, fields: "nextPageToken, files(name)", pageSize: 1000, pageToken, spaces: "drive",
          supportsAllDrives: true, includeItemsFromAllDrives: true
        });
        for (const file of Array.isArray(res?.data?.files) ? res.data.files : []) {
          const full = String(file?.name || "");
          if (wantPrefix && !full.startsWith(wantPrefix)) continue;
          const rel = stripDrivePrefix(base, full);
          if (rel) keys.push(rel);
        }
        pageToken = res?.data?.nextPageToken;
        if (!pageToken) break;
      }
      return keys;
    }
  };
}
