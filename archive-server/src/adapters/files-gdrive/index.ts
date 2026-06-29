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
  statusCode: number;

  constructor(message: string, { statusCode = 502 }: { statusCode?: number } = {}) {
    super(message);
    this.name = "DriveFileError";
    this.statusCode = statusCode ?? 502;
  }
}

interface BlobResult {
  key: string;
  url: string;
}

type Credentials = Record<string, unknown> | string | null;

/** Map a FileStore key (+ optional prefix) to a Drive file name (traversal-safe). */
export function driveFileName(prefix: string | undefined, key: string | number): string {
  const clean = String(key || "").replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new DriveFileError("Invalid file key.", { statusCode: 400 });
  }
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  return base ? `${base}/${clean}` : clean;
}

/** Strip the configured prefix off a Drive file name → relative FileStore key. */
export function stripDrivePrefix(prefix: string | undefined, name: string | undefined): string {
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  const full = String(name || "");
  if (!base) return full;
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full;
}

/** Escape a value for use inside a Drive `q` query string literal. */
function escapeQuery(value: string | undefined): string {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function toBytes(blob: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof (blob as Record<string, unknown>).arrayBuffer === "function") return Buffer.from(await ((blob as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>)());
  return Buffer.alloc(0);
}

function parseCredentials(raw: Credentials): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try { return JSON.parse(raw); } catch { return null; }
}

interface DriveClient {
  files: {
    list(opts: Record<string, unknown>): Promise<{ data?: { files?: Array<{ id?: string; name?: string }> } }>;
    get(
      opts: Record<string, unknown>,
      config?: Record<string, unknown>
    ): Promise<{ data?: Buffer | ArrayBuffer | string }>;
    update(opts: Record<string, unknown>): Promise<void>;
    create(opts: Record<string, unknown>): Promise<void>;
    delete(opts: Record<string, unknown>): Promise<void>;
  };
}

function buildDriveClient({ credentials }: { credentials: Credentials }): DriveClient {
  const creds = parseCredentials(credentials);
  if (!creds?.client_email || !creds?.private_key) {
    throw new Error("Google Drive file store needs GDRIVE_CREDENTIALS (service-account JSON).");
  }
  const auth = new JWT({ email: creds.client_email as string, key: creds.private_key as string, scopes: SCOPES });
  const client = driveApi({ version: "v3", auth }) as unknown as Record<string, unknown>;
  return client.files ? (client as unknown as DriveClient) : driveApi({ version: "v3", auth }) as unknown as DriveClient;
}

interface GoogleDriveOptions {
  driveClient?: DriveClient;
  folderId?: string;
  credentials?: Credentials;
  prefix?: string;
  accessTokenExpiresAt?: number;
  [key: string]: unknown;
}

export function createGoogleDriveFileStore({
  driveClient,
  folderId = process.env.GDRIVE_FOLDER_ID,
  credentials = process.env.GDRIVE_CREDENTIALS,
  prefix = process.env.GDRIVE_PREFIX || "",
  accessTokenExpiresAt = 0
}: GoogleDriveOptions = {}) {
  // accessTokenExpiresAt is here to accept it; it's not used (only in the signature for interface compatibility)
  if (!folderId) throw new Error("Google Drive file store needs GDRIVE_FOLDER_ID.");
  const drive = driveClient || buildDriveClient({ credentials: credentials ?? "" });

  async function findFileId(name: string): Promise<string | null> {
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
    async putBlob(key: string | number, blob: unknown, meta: Record<string, string> = {}): Promise<BlobResult> {
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

    async getBlob(key: string | number): Promise<Buffer | null> {
      const name = driveFileName(prefix, key);
      const id = await findFileId(name);
      if (!id) return null;
      const res = await drive.files.get({ fileId: id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
      const data = res?.data;
      if (data == null) return null;
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof ArrayBuffer) return Buffer.from(data);
      if (ArrayBuffer.isView(data)) return Buffer.from((data as ArrayBufferView).buffer, (data as ArrayBufferView).byteOffset, (data as ArrayBufferView).byteLength);
      return Buffer.from(String(data)); // string fallback
    },

    // Drive has no stable anonymous URL without explicit sharing; downloads flow
    // through the server (getBlob). Return null so callers use that path.
    async getUrl(): Promise<null> {
      return null;
    },

    async remove(key: string | number): Promise<void> {
      const name = driveFileName(prefix, key);
      const id = await findFileId(name);
      if (!id) return; // idempotent
      await drive.files.delete({ fileId: id, supportsAllDrives: true });
    },

    async list(listPrefix: string = ""): Promise<string[]> {
      const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
      const userPrefix = String(listPrefix || "").replace(/^[/\\]+/, "");
      const wantPrefix = [base, userPrefix].filter(Boolean).join("/");
      const q = `'${escapeQuery(folderId)}' in parents and trashed=false`;
      const keys: string[] = [];
      let pageToken: string | undefined;
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
        pageToken = (res?.data as Record<string, unknown>)?.nextPageToken as string | undefined;
        if (!pageToken) break;
      }
      return keys;
    }
  };
}
