export class SystemControlError extends Error {
  status?: number;

  constructor(message: string, { status }: { status?: number } = {}) {
    super(message);
    this.name = "SystemControlError";
    this.status = status;
  }
}

interface ControlResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

type ControlFetch = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<ControlResponse>;

interface ControlPayload {
  ok?: boolean;
  result?: unknown;
  error?: string;
  [key: string]: unknown;
}

function resolveFetch(fetchImpl?: ControlFetch): ControlFetch {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) as ControlFetch : null);
  if (!doFetch) throw new SystemControlError("لا يوجد منفّذ fetch.");
  return doFetch;
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readPayload(response: ControlResponse): Promise<ControlPayload> {
  try {
    return await response.json() as ControlPayload;
  } catch {
    throw new SystemControlError("استجابة مركز التحكم غير صالحة.", { status: response.status });
  }
}

async function unwrapResponse<T = unknown>(response: ControlResponse): Promise<T> {
  const payload = await readPayload(response);
  if (!response.ok || payload?.ok === false) {
    throw new SystemControlError(payload?.error || "فشل الاتصال بمركز التحكم.", { status: response.status });
  }
  return (payload?.result ?? payload) as T;
}

interface BaseControlOptions {
  baseUrl?: string;
  token?: string;
  fetchImpl?: ControlFetch;
}

export interface FetchControlStatusOptions extends BaseControlOptions {
  checkedAt?: string;
}

export async function fetchControlStatus<T extends object = Record<string, unknown>>({
  baseUrl = "",
  token = "",
  fetchImpl,
  checkedAt = new Date().toISOString()
}: FetchControlStatusOptions = {}): Promise<T & { checkedAt: string }> {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const response = await resolveFetch(fetchImpl)(`${base}/api/control/status`, {
    method: "GET",
    headers: authHeaders(token)
  });
  return { ...(await unwrapResponse<T>(response)), checkedAt };
}

export interface FetchControlLogsOptions extends BaseControlOptions {
  service?: string;
  limit?: number;
}

export async function fetchControlLogs<T = unknown>({
  baseUrl = "",
  service = "archive-api",
  limit = 100,
  token = "",
  fetchImpl
}: FetchControlLogsOptions = {}): Promise<T> {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("service", String(service || "archive-api"));
  params.set("limit", String(Math.min(Math.max(Number(limit) || 100, 1), 500)));
  const response = await resolveFetch(fetchImpl)(`${base}/api/control/logs?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(token)
  });
  return unwrapResponse<T>(response);
}

export interface RunControlActionOptions extends BaseControlOptions {
  action?: string;
  service?: string;
}

export async function runControlAction<T = unknown>({
  baseUrl = "",
  action,
  service,
  token = "",
  fetchImpl
}: RunControlActionOptions = {}): Promise<T> {
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
  return unwrapResponse<T>(response);
}
