import { localSyncProvider } from "../local-sync/index.js";

export class CloudSyncError extends Error {
  status?: number;

  constructor(message: string, { status }: { status?: number } = {}) {
    super(message);
    this.name = "CloudSyncError";
    this.status = status;
  }
}

type FetchLike = typeof fetch;
type EventSourceLike = typeof EventSource;

function baseEndpoint(baseUrl: string, path: string) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

function headers(getToken: undefined | (() => string), extra: Record<string, string> = {}) {
  const result = { ...extra };
  const token = typeof getToken === "function" ? getToken() : "";
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

async function parseResult(response: Response, fallback: string) {
  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new CloudSyncError(fallback, { status: response.status });
  }
  if (!response.ok || !payload?.ok) {
    throw new CloudSyncError(payload?.error || fallback, { status: response.status });
  }
  return payload.result;
}

export function createCloudSyncProvider({
  baseUrl = "",
  fetchImpl,
  getToken,
  EventSourceImpl
}: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  getToken?: () => string;
  EventSourceImpl?: EventSourceLike;
} = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("cloud sync provider needs a fetch implementation.");
  // EventSource is a browser global; injectable so node tests can supply a fake.
  const ES = EventSourceImpl || (typeof EventSource !== "undefined" ? EventSource : null);

  return {
    ...localSyncProvider,
    /**
     * Live realtime stream from the server (SSE). Calls `onChange(change)` for
     * each change another device pushes. Returns an unsubscribe that closes the
     * stream. No-ops (returns inert) when EventSource is unavailable — callers
     * fall back to pullSince polling.
     *
     * The JWT can't go in a header (EventSource limitation), so it rides as a
     * `?token=` query param the server validates.
     */
    subscribe(onChange: (change: any) => void) {
      if (!ES || typeof onChange !== "function") return () => {};
      const token = typeof getToken === "function" ? getToken() : "";
      const url = baseEndpoint(baseUrl, `/api/sync/events${token ? `?token=${encodeURIComponent(token)}` : ""}`);
      let source: EventSource | null;
      try {
        source = new ES(url);
      } catch {
        return () => {};
      }
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "change") onChange(payload.change);
        } catch {
          // ignore malformed frames
        }
      };
      // Errors (network drop, 401) — EventSource auto-reconnects on transient
      // drops; we leave it to do so. A persistent 401 closes the stream.
      return () => { try { source?.close(); } catch {
        // already closed
      } };
    },
    async pushChange(change: any = {}) {
      const response = await doFetch(baseEndpoint(baseUrl, "/api/sync/push"), {
        method: "POST",
        headers: headers(getToken, { "Content-Type": "application/json" }),
        body: JSON.stringify(change)
      });
      return parseResult(response, "فشل رفع تغيير المزامنة.");
    },
    async pullSince(cursor = 0) {
      const response = await doFetch(baseEndpoint(baseUrl, `/api/sync/pull?cursor=${encodeURIComponent(cursor || 0)}`), {
        method: "GET",
        headers: headers(getToken)
      });
      return parseResult(response, "فشل جلب تغييرات المزامنة.");
    }
  };
}
