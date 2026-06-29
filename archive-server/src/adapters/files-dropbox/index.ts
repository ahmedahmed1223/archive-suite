// Dropbox FileStore adapter (G3) — implements the @archive/core FileStore port
// against the Dropbox HTTP API, so uploaded media can live in a Dropbox app
// folder instead of the server's local disk. Selected via FILE_STORE=dropbox.
//
// The access token stays server-side (env DROPBOX_ACCESS_TOKEN); the SPA still
// talks only to /api/files/* and never sees Dropbox. `fetchImpl` is injectable
// so the adapter is unit-tested without touching the network.

const CONTENT_BASE = "https://content.dropboxapi.com/2";
const RPC_BASE = "https://api.dropboxapi.com/2";
const OAUTH_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";

export class DropboxFileError extends Error {
  statusCode: number;
  summary?: string;

  constructor(message: string, { statusCode = 502, summary }: { statusCode?: number; summary?: string } = {}) {
    super(message);
    this.name = "DropboxFileError";
    this.statusCode = statusCode ?? 502;
    this.summary = summary as string | undefined;
  }
}

interface BlobResult {
  key: string;
  url: string;
  path?: string;
}

type FetchImpl = (url: string, opts?: Record<string, unknown>) => Promise<Response>;

interface Response {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** Map a FileStore key to an absolute Dropbox path under rootPath (traversal-safe). */
export function dropboxPath(rootPath: string | undefined, key: string | number): string {
  const clean = String(key || "").replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new DropboxFileError("Invalid file key.", { statusCode: 400 });
  }
  const base = String(rootPath || "").replace(/\/+$/, ""); // "" or "/archive"
  return `${base}/${clean}`; // always starts with "/"
}

/** Listing root for Dropbox list_folder: "" means the account root. */
function listRoot(rootPath: string | undefined): string {
  return String(rootPath || "").replace(/\/+$/, "");
}

async function blobToBuffer(blob: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof (blob as Record<string, unknown>).arrayBuffer === "function") return Buffer.from(await ((blob as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>)());
  return Buffer.alloc(0);
}

/** Did a Dropbox error body describe a missing path? (download/get_temporary_link) */
function isNotFound(summary: string = ""): boolean {
  return /not_found/.test(String(summary || ""));
}

interface DropboxOptions {
  accessToken?: string;
  refreshToken?: string;
  appKey?: string;
  appSecret?: string;
  accessTokenExpiresAt?: number;
  rootPath?: string;
  selectUser?: string;
  selectAdmin?: string;
  fetchImpl?: FetchImpl;
  [key: string]: unknown;
}

export function createDropboxFileStore({
  accessToken = process.env.DROPBOX_ACCESS_TOKEN,
  refreshToken = process.env.DROPBOX_REFRESH_TOKEN,
  appKey = process.env.DROPBOX_APP_KEY,
  appSecret = process.env.DROPBOX_APP_SECRET,
  accessTokenExpiresAt = 0,
  rootPath = process.env.DROPBOX_ROOT_PATH || "",
  selectUser = process.env.DROPBOX_SELECT_USER || "",
  selectAdmin = process.env.DROPBOX_SELECT_ADMIN || "",
  fetchImpl
}: DropboxOptions = {}) {
  const doFetch: FetchImpl = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null) as FetchImpl;
  if (!doFetch) throw new Error("Dropbox file store needs a fetch implementation.");
  if (!accessToken && !(refreshToken && appKey && appSecret)) {
    throw new Error("Dropbox file store needs DROPBOX_ACCESS_TOKEN or DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET.");
  }

  let currentAccessToken = accessToken || "";
  let currentExpiresAt: number = (accessTokenExpiresAt as number) || 0;

  async function refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken as string
    }).toString();
    const res = await doFetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
    if (!res.ok || !json?.access_token) {
      throw new DropboxFileError(`Dropbox token refresh failed (${res.status}).`, { statusCode: 502, summary: (json?.error_summary as string | undefined) || text });
    }
    currentAccessToken = json.access_token as string;
    const ttl = Math.max(60, Number(json.expires_in || 14_400));
    currentExpiresAt = Date.now() + (ttl * 1000) - 60_000;
    return currentAccessToken;
  }

  async function getAccessToken(): Promise<string> {
    if (refreshToken && (!currentAccessToken || Date.now() >= currentExpiresAt)) return refreshAccessToken();
    return currentAccessToken;
  }

  async function dropboxHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await getAccessToken()}`,
      ...(selectUser ? { "Dropbox-API-Select-User": selectUser } : {}),
      ...(selectAdmin ? { "Dropbox-API-Select-Admin": selectAdmin } : {}),
      ...extra
    };
  }

  async function rpc(endpoint: string, body: Record<string, unknown>): Promise<{ res: Response; json: Record<string, unknown> }> {
    const res = await doFetch(`${RPC_BASE}${endpoint}`, {
      method: "POST",
      headers: await dropboxHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
    return { res, json };
  }

  return {
    describe() {
      return {
        kind: "dropbox",
        label: "Dropbox",
        rootPath: rootPath || "",
        configured: Boolean(accessToken || refreshToken),
        auth: refreshToken ? "oauth-refresh-token" : "access-token",
        accountMode: selectUser || selectAdmin ? "team-select" : refreshToken ? "oauth" : "single-token",
        selectUser: selectUser || undefined,
        selectAdmin: selectAdmin || undefined
      };
    },
    async putBlob(key: string | number, blob: unknown): Promise<BlobResult> {
      const dpath = dropboxPath(rootPath, key);
      const bytes = await blobToBuffer(blob);
      const res = await doFetch(`${CONTENT_BASE}/files/upload`, {
        method: "POST",
        headers: await dropboxHeaders({
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({ path: dpath, mode: "overwrite", mute: true, strict_conflict: false })
        }),
        body: bytes
      });
      if (!res.ok) {
        const summary = await res.text().catch(() => "");
        throw new DropboxFileError(`Dropbox upload failed (${res.status}).`, { statusCode: 502, summary });
      }
      const clean = dpath.replace(/^\/+/, "");
      // Keep the SPA contract identical to disk: download flows through the server.
      return { key: String(key).replace(/^\/+/, ""), url: `/api/files/${encodeURIComponent(String(key).replace(/^\/+/, ""))}`, path: clean };
    },

    async getBlob(key: string | number): Promise<Buffer | null> {
      const dpath = dropboxPath(rootPath, key);
      const res = await doFetch(`${CONTENT_BASE}/files/download`, {
        method: "POST",
        headers: await dropboxHeaders({ "Dropbox-API-Arg": JSON.stringify({ path: dpath }) })
      });
      if (res.ok) {
        const arrayBufFn = (res as unknown as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>;
        return Buffer.from(await arrayBufFn());
      }
      // Dropbox returns 409 with a JSON error summary for a missing path.
      const summary = await res.text().catch(() => "");
      if (res.status === 409 && isNotFound(summary)) return null;
      throw new DropboxFileError(`Dropbox download failed (${res.status}).`, { statusCode: 502, summary });
    },

    async getUrl(key: string | number): Promise<string | null> {
      const dpath = dropboxPath(rootPath, key);
      const { res, json } = await rpc("/files/get_temporary_link", { path: dpath });
      if (res.ok && json?.link) return json.link as string;
      if (res.status === 409 && isNotFound(json?.error_summary as string)) return null;
      return null; // displayable URL is best-effort
    },

    async remove(key: string | number): Promise<void> {
      const dpath = dropboxPath(rootPath, key);
      const { res, json } = await rpc("/files/delete_v2", { path: dpath });
      // Treat "already gone" as success (idempotent remove).
      if (res.ok || (res.status === 409 && isNotFound(json?.error_summary as string))) return;
      throw new DropboxFileError(`Dropbox delete failed (${res.status}).`, { statusCode: 502, summary: json?.error_summary as string });
    },

    async list(prefix: string = ""): Promise<string[]> {
      const root = listRoot(rootPath);
      const keys: string[] = [];
      let body: Record<string, unknown> = { path: root, recursive: true, limit: 2000 };
      let endpoint = "/files/list_folder";
      // Follow the cursor until has_more is false.
      for (let guard = 0; guard < 1000; guard += 1) {
        const { res, json } = await rpc(endpoint, body);
        if (!res.ok) {
          // An empty/never-created folder lists as nothing rather than erroring.
          if (res.status === 409 && isNotFound(json?.error_summary as string)) return [];
          throw new DropboxFileError(`Dropbox list failed (${res.status}).`, { statusCode: 502, summary: json?.error_summary as string });
        }
        for (const entry of Array.isArray(json.entries) ? json.entries : []) {
          const e = entry as Record<string, unknown>;
          if (e[".tag"] !== "file") continue;
          const full = String(e.path_display || e.path_lower || "");
          const rel = (root ? full.slice(root.length) : full).replace(/^\/+/, "");
          if (rel && rel.startsWith(String(prefix || ""))) keys.push(rel);
        }
        if (!json.has_more) break;
        endpoint = "/files/list_folder/continue";
        body = { cursor: json.cursor };
      }
      return keys;
    }
  };
}
