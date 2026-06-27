import contract from "../../docs/api/archive-contract.openapi.json";

export type ApiEnvelope<T extends Record<string, unknown> = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; details?: unknown };

export interface ArchiveUser {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  displayName?: string;
  email?: string;
  totpEnabled?: boolean;
}

export interface ArchiveRecord {
  id: string;
  title: string;
  store?: string;
  type?: string;
  subtype?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface RightsRecord {
  id: string;
  itemId: string;
  rightsHolder: string;
  licenseType: "OWNED" | "LICENSED" | "PUBLIC_DOMAIN" | "FAIR_USE" | "UNKNOWN";
  embargoStart?: string | null;
  embargoEnd?: string | null;
  expiresAt?: string | null;
  geoRestrictions?: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveApiClient {
  health(): Promise<ApiEnvelope<{ backend: string; engine: string; uptimeSec: number }>>;
  me(): Promise<ApiEnvelope<{ user: ArchiveUser }>>;
  search(params: { q?: string; store?: string; limit?: number }): Promise<ApiEnvelope<{ records: ArchiveRecord[] }>>;
  rights(itemId: string): Promise<ApiEnvelope<{ record: RightsRecord }>>;
  share(token: string): Promise<ApiEnvelope<{ records: ArchiveRecord[]; scope: Record<string, unknown> }>>;
}

export function getContractSummary() {
  return {
    title: contract.info.title,
    version: contract.info.version,
    routeCount: Object.keys(contract.paths).length
  };
}

export function createArchiveApiClient({
  baseUrl = "/api/v1",
  fetchImpl = fetch
}: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): ArchiveApiClient {
  async function get<T extends Record<string, unknown>>(path: string): Promise<ApiEnvelope<T>> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      credentials: "include"
    });

    const payload = (await response.json().catch(() => ({
      ok: false,
      error: `Invalid JSON response from ${path}`
    }))) as ApiEnvelope<T>;

    if (!response.ok && payload.ok !== false) {
      return { ok: false, error: `Request failed with status ${response.status}` };
    }

    return payload;
  }

  return {
    health: () => get("/health"),
    me: () => get("/auth/me"),
    search: ({ q = "", store = "", limit = 20 }) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (store) params.set("store", store);
      params.set("limit", String(limit));
      return get(`/search?${params.toString()}`);
    },
    rights: (itemId: string) => get(`/rights?itemId=${encodeURIComponent(itemId)}`),
    share: (token: string) => get(`/share/${encodeURIComponent(token)}`)
  };
}
