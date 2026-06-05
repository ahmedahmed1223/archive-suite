// SPA client for FileStore status endpoints.
//
// The server returns safe storage metadata only: provider kind, visible root,
// capabilities, and a light health check. Secrets never leave the server.

export class FileStoreConfigError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "FileStoreConfigError";
    this.status = status;
  }
}

export function canManageFileStore({ backend, token, role } = {}) {
  const isAdmin = role === "admin" || role === "owner";
  return backend !== "local" && Boolean(token) && isAdmin;
}

async function call(path, { method = "GET", body, baseUrl = "", getToken, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new FileStoreConfigError("لا يوجد منفّذ fetch.");
  const token = typeof getToken === "function" ? getToken() : "";
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkError) {
    throw new FileStoreConfigError(`تعذّر الاتصال بالخادم: ${networkError?.message || "خطأ شبكة"}`);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new FileStoreConfigError("استجابة غير صالحة من الخادم.", { status: response.status });
  }
  if (!response.ok || !payload?.ok) {
    if (response.status === 403) throw new FileStoreConfigError("هذه الإعدادات للمدير فقط.", { status: 403 });
    if (response.status === 401) throw new FileStoreConfigError("تسجيل الدخول مطلوب لقراءة حالة مخزن الملفات.", { status: 401 });
    throw new FileStoreConfigError(payload?.error || "فشل طلب حالة مخزن الملفات.", { status: response.status });
  }
  return payload.result;
}

export function fetchFileStoreStatus(opts = {}) {
  return call("/api/files/status", { method: "GET", ...opts });
}

export function fetchFileStoreConfig(opts = {}) {
  return call("/api/admin/config", { method: "GET", ...opts }).then((result) => result.fileStore);
}

export function saveFileStoreConfig({
  kind = "disk",
  diskRootDir = "",
  dropboxRootPath = "",
  dropboxAccessToken = "",
  dropboxRefreshToken = "",
  dropboxAppKey = "",
  dropboxAppSecret = "",
  dropboxSelectUser = "",
  dropboxSelectAdmin = "",
  ...opts
} = {}) {
  const fileStore = kind === "dropbox"
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
    };
  return call("/api/admin/config", { method: "POST", body: { fileStore }, ...opts });
}

export function startDropboxOAuth({
  rootPath = "",
  selectUser = "",
  selectAdmin = "",
  returnTo = "",
  ...opts
} = {}) {
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
