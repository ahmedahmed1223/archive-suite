export class FileManagerError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(
    message: string,
    { status = 0, code = "FILE_MANAGER_ERROR", retryable = false }: {
      status?: number;
      code?: string;
      retryable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "FileManagerError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

interface FileManagerResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  blob?(): Promise<Blob>;
}

type FileManagerFetch = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Blob | File;
}) => Promise<FileManagerResponse>;

interface RequestOptions {
  baseUrl?: string;
  getToken?: () => string;
  fetchImpl?: FileManagerFetch;
}

interface JsonOptions extends RequestOptions {
  method?: string;
  body?: unknown;
}

interface FileManagerPayload {
  ok?: boolean;
  error?: string;
  result?: unknown;
  details?: {
    code?: string;
    retryable?: boolean;
  };
}

interface BrowseFilesOptions extends RequestOptions {
  path?: string;
  query?: string;
  limit?: number;
  cursor?: string;
}

interface CreateFolderOptions extends RequestOptions {
  path?: string;
}

interface RunFileActionOptions extends RequestOptions {
  action?: string;
  keys?: string[];
  key?: string;
  name?: string;
  destination?: string;
}

interface ManagedFileOptions extends RequestOptions {
  key?: string;
}

interface UploadManagedFileOptions extends ManagedFileOptions {
  file?: Blob & { type?: string };
}

function requestDeps({ baseUrl = "", getToken, fetchImpl }: RequestOptions = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) as FileManagerFetch : null);
  if (!doFetch) throw new FileManagerError("لا يوجد منفّذ fetch.");
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const token = typeof getToken === "function" ? getToken() : "";
  return { doFetch, base, token };
}

async function callJson(path: string, { method = "GET", body, ...options }: JsonOptions = {}) {
  const { doFetch, base, token } = requestDeps(options);
  let response: FileManagerResponse;
  try {
    response = await doFetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw new FileManagerError(`تعذّر الاتصال بالخادم: ${(error as Error)?.message || "خطأ شبكة"}`, { retryable: true });
  }
  let payload: FileManagerPayload;
  try {
    payload = await response.json() as FileManagerPayload;
  } catch {
    throw new FileManagerError("استجابة غير صالحة من الخادم.", { status: response.status });
  }
  if (!response.ok || !payload?.ok) {
    throw new FileManagerError(payload?.error || "فشلت عملية الملفات.", {
      status: response.status,
      code: payload?.details?.code,
      retryable: payload?.details?.retryable ?? response.status >= 500
    });
  }
  return payload.result;
}

export function browseFiles({ path = "", query = "", limit = 200, cursor = "", ...options }: BrowseFilesOptions = {}) {
  const params = new URLSearchParams({ path: String(path), query: String(query), limit: String(Math.min(200, Number(limit) || 200)) });
  if (cursor) params.set("cursor", cursor);
  return callJson(`/api/files/browser?${params}`, options);
}

export function createFileFolder({ path, ...options }: CreateFolderOptions = {}) {
  return callJson("/api/files/folders", { method: "POST", body: { path }, ...options });
}

export function runFileAction({ action, keys, key, name, destination, ...options }: RunFileActionOptions = {}) {
  return callJson("/api/files/actions", {
    method: "POST",
    body: { action, ...(keys ? { keys } : {}), ...(key ? { key } : {}), ...(name ? { name } : {}), ...(destination !== undefined ? { destination } : {}) },
    ...options
  });
}

export async function uploadManagedFile({ key = "", file, ...options }: UploadManagedFileOptions = {}) {
  const { doFetch, base, token } = requestDeps(options);
  const response = await doFetch(`${base}/api/files/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(file?.type ? { "Content-Type": file.type } : {}) },
    body: file
  });
  const payload = await response.json().catch(() => null) as FileManagerPayload | null;
  if (!response.ok || !payload?.ok) throw new FileManagerError(payload?.error || "فشل رفع الملف.", { status: response.status, retryable: response.status >= 500 });
  return payload.result;
}

export async function downloadManagedFile({ key = "", ...options }: ManagedFileOptions = {}) {
  const { doFetch, base, token } = requestDeps(options);
  const response = await doFetch(`${base}/api/files/${encodeURIComponent(key)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new FileManagerError("تعذّر تنزيل الملف.", { status: response.status, retryable: response.status >= 500 });
  if (!response.blob) throw new FileManagerError("استجابة تنزيل غير صالحة.", { status: response.status });
  return response.blob();
}
