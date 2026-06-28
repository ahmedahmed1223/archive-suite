export class CloudFileError extends Error {
  status?: number;

  constructor(message: string, { status }: { status?: number } = {}) {
    super(message);
    this.name = "CloudFileError";
    this.status = status;
  }
}

type FetchLike = typeof fetch;

function endpoint(base: string, key = "") {
  const cleanBase = String(base || "").replace(/\/+$/, "");
  return key ? `${cleanBase}/api/files/${encodeURIComponent(key)}` : `${cleanBase}/api/files`;
}

function authHeaders(getToken: undefined | (() => string), extra: Record<string, string> = {}) {
  const headers = { ...extra };
  const token = typeof getToken === "function" ? getToken() : "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readJson(response: Response, fallback: string) {
  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new CloudFileError(fallback, { status: response.status });
  }
  if (!response.ok || !payload?.ok) {
    throw new CloudFileError(payload?.error || fallback, { status: response.status });
  }
  return payload.result;
}

export function createCloudFileStore({
  baseUrl = "",
  fetchImpl,
  getToken
}: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  getToken?: () => string;
} = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("cloud file store needs a fetch implementation.");

  return {
    async putBlob(key: string, blob: Blob) {
      const response = await doFetch(endpoint(baseUrl, key), {
        method: "PUT",
        headers: authHeaders(getToken, blob?.type ? { "Content-Type": blob.type } : {}),
        body: blob
      });
      return readJson(response, "فشل رفع الملف.");
    },
    async getBlob(key: string) {
      const response = await doFetch(endpoint(baseUrl, key), {
        method: "GET",
        headers: authHeaders(getToken)
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new CloudFileError("فشل تنزيل الملف.", { status: response.status });
      return response.blob();
    },
    async getUrl(key: string) {
      const response = await doFetch(`${endpoint(baseUrl)}/url?key=${encodeURIComponent(key)}`, {
        method: "GET",
        headers: authHeaders(getToken)
      });
      if (response.status === 404) return null;
      return readJson(response, "فشل جلب رابط الملف.");
    },
    async remove(key: string) {
      const response = await doFetch(endpoint(baseUrl, key), {
        method: "DELETE",
        headers: authHeaders(getToken)
      });
      await readJson(response, "فشل حذف الملف.");
    },
    async list(prefix = "") {
      const url = `${endpoint(baseUrl)}?prefix=${encodeURIComponent(prefix || "")}`;
      const response = await doFetch(url, {
        method: "GET",
        headers: authHeaders(getToken)
      });
      return readJson(response, "فشل جلب قائمة الملفات.");
    }
  };
}
