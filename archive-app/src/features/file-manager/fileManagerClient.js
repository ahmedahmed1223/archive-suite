export class FileManagerError extends Error {
  constructor(message, { status = 0, code = "FILE_MANAGER_ERROR", retryable = false } = {}) {
    super(message);
    this.name = "FileManagerError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function requestDeps({ baseUrl = "", getToken, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new FileManagerError("لا يوجد منفّذ fetch.");
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const token = typeof getToken === "function" ? getToken() : "";
  return { doFetch, base, token };
}

async function callJson(path, { method = "GET", body, ...options } = {}) {
  const { doFetch, base, token } = requestDeps(options);
  let response;
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
    throw new FileManagerError(`تعذّر الاتصال بالخادم: ${error?.message || "خطأ شبكة"}`, { retryable: true });
  }
  let payload;
  try { payload = await response.json(); } catch { throw new FileManagerError("استجابة غير صالحة من الخادم.", { status: response.status }); }
  if (!response.ok || !payload?.ok) {
    throw new FileManagerError(payload?.error || "فشلت عملية الملفات.", {
      status: response.status,
      code: payload?.details?.code,
      retryable: payload?.details?.retryable ?? response.status >= 500
    });
  }
  return payload.result;
}

export function browseFiles({ path = "", query = "", limit = 200, cursor = "", ...options } = {}) {
  const params = new URLSearchParams({ path: String(path), query: String(query), limit: String(Math.min(200, Number(limit) || 200)) });
  if (cursor) params.set("cursor", cursor);
  return callJson(`/api/files/browser?${params}`, options);
}

export function createFileFolder({ path, ...options } = {}) {
  return callJson("/api/files/folders", { method: "POST", body: { path }, ...options });
}

export function runFileAction({ action, keys, key, name, destination, ...options } = {}) {
  return callJson("/api/files/actions", {
    method: "POST",
    body: { action, ...(keys ? { keys } : {}), ...(key ? { key } : {}), ...(name ? { name } : {}), ...(destination !== undefined ? { destination } : {}) },
    ...options
  });
}

export async function uploadManagedFile({ key, file, ...options } = {}) {
  const { doFetch, base, token } = requestDeps(options);
  const response = await doFetch(`${base}/api/files/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(file?.type ? { "Content-Type": file.type } : {}) },
    body: file
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new FileManagerError(payload?.error || "فشل رفع الملف.", { status: response.status, retryable: response.status >= 500 });
  return payload.result;
}

export async function downloadManagedFile({ key, ...options } = {}) {
  const { doFetch, base, token } = requestDeps(options);
  const response = await doFetch(`${base}/api/files/${encodeURIComponent(key)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new FileManagerError("تعذّر تنزيل الملف.", { status: response.status, retryable: response.status >= 500 });
  return response.blob();
}
