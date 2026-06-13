export class MediaClientError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "MediaClientError";
    this.status = status;
  }
}

function endpoint(baseUrl, path) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

function authHeaders(getToken, extra = {}) {
  const headers = { ...extra };
  const token = typeof getToken === "function" ? getToken() : "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readJson(response, fallback) {
  let payload;
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

export function createMediaClient({ baseUrl = "", getToken, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new MediaClientError("لا يوجد منفّذ fetch.");

  async function post(path, body, fallback) {
    const response = await doFetch(endpoint(baseUrl, path), {
      method: "POST",
      headers: authHeaders(getToken, { "Content-Type": "application/json" }),
      body: JSON.stringify(body || {})
    });
    return readJson(response, fallback);
  }

  async function get(path, fallback) {
    const response = await doFetch(endpoint(baseUrl, path), {
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
