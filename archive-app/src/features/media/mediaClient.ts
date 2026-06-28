export interface MediaClientErrorOptions {
  status?: number;
}

export class MediaClientError extends Error {
  status?: number;

  constructor(message: string, { status }: MediaClientErrorOptions = {}) {
    super(message);
    this.name = "MediaClientError";
    this.status = status;
  }
}

export interface MediaClientOptions {
  baseUrl?: string;
  getToken?: () => string;
  fetchImpl?: FetchLike | null;
}

type FetchLike = (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{
  json: () => Promise<any>;
  ok: boolean;
  status: number;
}>;

export interface MediaClient {
  probe(key: string): Promise<unknown>;
  thumbnail(key: string, params?: Record<string, unknown>): Promise<unknown>;
  audio(key: string, params?: Record<string, unknown>): Promise<unknown>;
  preview(key: string, params?: Record<string, unknown>): Promise<unknown>;
  transcode(key: string, params?: Record<string, unknown>): Promise<unknown>;
  montage(timeline: unknown, params?: Record<string, unknown>): Promise<unknown>;
  listJobs(): Promise<unknown>;
  getJob(id: string): Promise<unknown>;
  retryJob(id: string): Promise<unknown>;
}

function endpoint(baseUrl: string | null | undefined, path: string): string {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

function authHeaders(getToken: MediaClientOptions["getToken"], extra: Record<string, string> = {}): Record<string, string> {
  const headers = { ...extra };
  const token = typeof getToken === "function" ? getToken() : "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readJson(response: { json: () => Promise<any>; ok: boolean; status: number }, fallback: string): Promise<unknown> {
  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new MediaClientError(fallback, { status: response.status });
  }
  if (!response.ok || !payload?.ok) {
    throw new MediaClientError(payload?.error || fallback, { status: response.status });
  }
  return payload.result;
}

export function createMediaClient({ baseUrl = "", getToken, fetchImpl }: MediaClientOptions = {}): MediaClient {
  const runtimeFetch = (globalThis as { fetch?: FetchLike }).fetch;
  const doFetch = fetchImpl || (runtimeFetch ? runtimeFetch.bind(globalThis) : null);
  if (!doFetch) throw new MediaClientError("لا يوجد منفّذ fetch.");
  const fetcher = doFetch;

  async function post(path: string, body: Record<string, unknown>, fallback: string): Promise<unknown> {
    const response = await fetcher(endpoint(baseUrl, path), {
      method: "POST",
      headers: authHeaders(getToken, { "Content-Type": "application/json" }),
      body: JSON.stringify(body || {})
    });
    return readJson(response, fallback);
  }

  async function get(path: string, fallback: string): Promise<unknown> {
    const response = await fetcher(endpoint(baseUrl, path), {
      method: "GET",
      headers: authHeaders(getToken)
    });
    return readJson(response, fallback);
  }

  return {
    probe(key) {
      return post("/api/media/probe", { key }, "فشل استخراج بيانات الوسائط.");
    },
    thumbnail(key, params = {}) {
      return post("/api/media/thumbnail", { key, ...params }, "فشل إنشاء الصورة المصغّرة.");
    },
    audio(key, params = {}) {
      return post("/api/media/audio", { key, ...params }, "فشل استخراج الصوت.");
    },
    preview(key, params = {}) {
      return post("/api/media/preview", { key, ...params }, "فشل إنشاء معاينة GIF.");
    },
    transcode(key, params = {}) {
      return post("/api/media/jobs", { type: "transcode", key, ...params }, "فشل إنشاء مهمة التحويل.");
    },
    montage(timeline, params = {}) {
      return post("/api/media/jobs", { type: "montage", timeline, ...params }, "فشل إنشاء مهمة المونتاج.");
    },
    listJobs() {
      return get("/api/media/jobs", "فشل جلب مهام الوسائط.");
    },
    getJob(id) {
      return get(`/api/media/jobs/${encodeURIComponent(id)}`, "فشل جلب مهمة الوسائط.");
    },
    retryJob(id) {
      return post(`/api/media/jobs/${encodeURIComponent(id)}/retry`, {}, "فشل إعادة محاولة المهمة.");
    }
  };
}
