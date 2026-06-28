// SPA client for FileStore status endpoints.
//
// The server returns safe storage metadata only: provider kind, visible root,
// capabilities, and a light health check. Secrets never leave the server.

export class FileStoreConfigError extends Error {
  status?: number;

  constructor(message: string, { status }: { status?: number } = {}) {
    super(message);
    this.name = "FileStoreConfigError";
    this.status = status;
  }
}

type FileStoreRole = "admin" | "owner" | string;

export interface FileStoreManageOptions {
  backend?: string;
  token?: string | null;
  role?: FileStoreRole | null;
}

export function canManageFileStore({ backend, token, role }: FileStoreManageOptions = {}): boolean {
  const isAdmin = role === "admin" || role === "owner";
  return backend !== "local" && Boolean(token) && isAdmin;
}

type JsonRecord = Record<string, unknown>;

interface FileStoreResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

type FileStoreFetch = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<FileStoreResponse>;

interface FileStorePayload {
  ok?: boolean;
  result?: unknown;
  error?: string;
}

interface CallOptions {
  method?: string;
  body?: unknown;
  baseUrl?: string;
  getToken?: () => string;
  fetchImpl?: FileStoreFetch;
}

async function call<T = unknown>(
  path: string,
  { method = "GET", body, baseUrl = "", getToken, fetchImpl }: CallOptions = {}
): Promise<T> {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) as FileStoreFetch : null);
  if (!doFetch) throw new FileStoreConfigError("لا يوجد منفّذ fetch.");
  const token = typeof getToken === "function" ? getToken() : "";
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response: FileStoreResponse;
  try {
    response = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : "خطأ شبكة";
    throw new FileStoreConfigError(`تعذّر الاتصال بالخادم: ${message}`);
  }
  let payload: FileStorePayload;
  try {
    payload = await response.json() as FileStorePayload;
  } catch {
    throw new FileStoreConfigError("استجابة غير صالحة من الخادم.", { status: response.status });
  }
  if (!response.ok || !payload?.ok) {
    if (response.status === 403) throw new FileStoreConfigError("هذه الإعدادات للمدير فقط.", { status: 403 });
    if (response.status === 401) {
      throw new FileStoreConfigError("تسجيل الدخول مطلوب لقراءة حالة مخزن الملفات.", { status: 401 });
    }
    throw new FileStoreConfigError(payload?.error || "فشل طلب حالة مخزن الملفات.", { status: response.status });
  }
  return payload.result as T;
}

export interface FileStoreRequestOptions extends Omit<CallOptions, "method" | "body"> {}

export function fetchFileStoreStatus<T = unknown>(opts: FileStoreRequestOptions = {}): Promise<T> {
  return call<T>("/api/files/status", { method: "GET", ...opts });
}

interface AdminConfigResult {
  fileStore?: unknown;
}

export function fetchFileStoreConfig<T = unknown>(opts: FileStoreRequestOptions = {}): Promise<T | undefined> {
  return call<AdminConfigResult>("/api/admin/config", { method: "GET", ...opts }).then((result) => result.fileStore as T);
}

export interface SaveFileStoreConfigOptions extends FileStoreRequestOptions {
  kind?: string;
  config?: JsonRecord;
  diskRootDir?: string;
  dropboxRootPath?: string;
  dropboxAccessToken?: string;
  dropboxRefreshToken?: string;
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  dropboxSelectUser?: string;
  dropboxSelectAdmin?: string;
}

export function saveFileStoreConfig({
  kind = "disk",
  config,
  diskRootDir = "",
  dropboxRootPath = "",
  dropboxAccessToken = "",
  dropboxRefreshToken = "",
  dropboxAppKey = "",
  dropboxAppSecret = "",
  dropboxSelectUser = "",
  dropboxSelectAdmin = "",
  ...opts
}: SaveFileStoreConfigOptions = {}): Promise<unknown> {
  const generic = config && typeof config === "object" ? { kind, [kind]: config } : null;
  const fileStore = generic || (kind === "dropbox"
    ? {
      kind,
      dropbox: {
        rootPath: String(dropboxRootPath || "").trim(),
        ...(String(dropboxAccessToken || "").trim() ? { accessToken: String(dropboxAccessToken || "").trim() } : {}),
        ...(String(dropboxRefreshToken || "").trim() ? { refreshToken: String(dropboxRefreshToken || "").trim() } : {}),
        ...(String(dropboxAppKey || "").trim() ? { appKey: String(dropboxAppKey || "").trim() } : {}),
        ...(String(dropboxAppSecret || "").trim() ? { appSecret: String(dropboxAppSecret || "").trim() } : {}),
        selectUser: String(dropboxSelectUser || "").trim(),
        selectAdmin: String(dropboxSelectAdmin || "").trim()
      }
    }
    : {
      kind: "disk",
      disk: {
        rootDir: String(diskRootDir || "").trim()
      }
    });
  return call("/api/admin/config", { method: "POST", body: { fileStore }, ...opts });
}

export interface TestFileStoreProviderOptions extends FileStoreRequestOptions {
  kind?: string;
  config?: JsonRecord;
}

export function testFileStoreProvider({
  kind = "disk",
  config = {},
  ...opts
}: TestFileStoreProviderOptions = {}): Promise<unknown> {
  return call("/api/files/test-provider", {
    method: "POST",
    body: { kind, [kind]: config },
    ...opts
  });
}

export interface StartDropboxOAuthOptions extends FileStoreRequestOptions {
  rootPath?: string;
  selectUser?: string;
  selectAdmin?: string;
  returnTo?: string;
}

export function startDropboxOAuth({
  rootPath = "",
  selectUser = "",
  selectAdmin = "",
  returnTo = "",
  ...opts
}: StartDropboxOAuthOptions = {}): Promise<unknown> {
  return call("/api/admin/dropbox/oauth/start", {
    method: "POST",
    body: {
      rootPath: String(rootPath || "").trim(),
      selectUser: String(selectUser || "").trim(),
      selectAdmin: String(selectAdmin || "").trim(),
      returnTo: String(returnTo || "").trim()
    },
    ...opts
  });
}
