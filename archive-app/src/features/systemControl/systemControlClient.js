export class SystemControlError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "SystemControlError";
    this.status = status;
  }
}

function resolveFetch(fetchImpl) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new SystemControlError("لا يوجد منفّذ fetch.");
  return doFetch;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    throw new SystemControlError("استجابة مركز التحكم غير صالحة.", { status: response.status });
  }
}

async function unwrapResponse(response) {
  const payload = await readPayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new SystemControlError(payload?.error || "فشل الاتصال بمركز التحكم.", { status: response.status });
  }
  return payload?.result ?? payload;
}

export async function fetchControlStatus({
  baseUrl = "",
  token = "",
  fetchImpl,
  checkedAt = new Date().toISOString()
} = {}) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const response = await resolveFetch(fetchImpl)(`${base}/api/control/status`, {
    method: "GET",
    headers: authHeaders(token)
  });
  return { ...(await unwrapResponse(response)), checkedAt };
}

export async function fetchControlLogs({
  baseUrl = "",
  service = "archive-api",
  limit = 100,
  token = "",
  fetchImpl
} = {}) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("service", String(service || "archive-api"));
  params.set("limit", String(Math.min(Math.max(Number(limit) || 100, 1), 500)));
  const response = await resolveFetch(fetchImpl)(`${base}/api/control/logs?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(token)
  });
  return unwrapResponse(response);
}

export async function runControlAction({
  baseUrl = "",
  action,
  service,
  token = "",
  fetchImpl
} = {}) {
  const safeAction = String(action || "").trim();
  if (!safeAction) throw new SystemControlError("إجراء مركز التحكم غير محدد.");
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const response = await resolveFetch(fetchImpl)(`${base}/api/control/${encodeURIComponent(safeAction)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ service })
  });
  return unwrapResponse(response);
}
