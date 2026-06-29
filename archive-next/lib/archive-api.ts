import contract from "../../docs/api/archive-contract.openapi.json";

export type ApiEnvelope<T extends object = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; details?: unknown };

export interface ArchiveUser {
  id: string;
  username?: string;
  role?: "admin" | "editor" | "viewer";
  roles?: string[];
  name?: string;
  displayName?: string;
  email?: string;
  totpEnabled?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  user: ArchiveUser;
  accessToken: string;
  expiresAt: string;
}

export interface ArchiveRecord {
  id: string;
  uid?: string;
  title: string;
  description?: string;
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

export type MediaOperation = "thumbnail" | "transcode" | "transcription";
export type MediaJobStatus = "queued" | "processing" | "completed" | "failed";

export interface MediaJob {
  id: string;
  recordId: string;
  operation: MediaOperation;
  status: MediaJobStatus;
  sourcePath?: string | null;
  options?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ArchiveApiClient {
  health(): Promise<ApiEnvelope<{ backend: string; engine: string; uptimeSec: number }>>;
  login(payload: LoginRequest): Promise<ApiEnvelope<AuthSession>>;
  me(options?: AuthRequestOptions): Promise<ApiEnvelope<{ user: ArchiveUser }>>;
  refresh(): Promise<ApiEnvelope<AuthSession>>;
  logout(options?: AuthRequestOptions): Promise<ApiEnvelope>;
  search(
    params: { q?: string; store?: string; limit?: number },
    options?: AuthRequestOptions
  ): Promise<ApiEnvelope<{ records: ArchiveRecord[] }>>;
  rights(itemId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: RightsRecord }>>;
  mediaJob(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  share(token: string): Promise<ApiEnvelope<{ records: ArchiveRecord[]; scope: Record<string, unknown>; permission?: string }>>;
}

export interface AuthRequestOptions {
  accessToken?: string;
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
  async function request<T extends object>(
    path: string,
    {
      method = "GET",
      body,
      accessToken
    }: {
      method?: "GET" | "POST";
      body?: unknown;
      accessToken?: string;
    } = {}
  ): Promise<ApiEnvelope<T>> {
    const headers = new Headers({ Accept: "application/json" });

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body)
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

  const get = <T extends object>(path: string, options?: AuthRequestOptions) =>
    request<T>(path, { accessToken: options?.accessToken });

  const post = <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) =>
    request<T>(path, { method: "POST", body, accessToken: options?.accessToken });

  return {
    health: () => get("/health"),
    login: (payload: LoginRequest) => post<AuthSession>("/auth/login", payload),
    me: (options?: AuthRequestOptions) => get("/auth/me", options),
    refresh: () => post<AuthSession>("/auth/refresh"),
    logout: (options?: AuthRequestOptions) => post("/auth/logout", undefined, options),
    search: ({ q = "", store = "", limit = 20 }, options?: AuthRequestOptions) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (store) params.set("store", store);
      params.set("limit", String(limit));
      return get(`/search?${params.toString()}`, options);
    },
    rights: (itemId: string, options?: AuthRequestOptions) => get(`/rights?itemId=${encodeURIComponent(itemId)}`, options),
    mediaJob: (id: string, options?: AuthRequestOptions) => get(`/media/jobs/${encodeURIComponent(id)}`, options),
    share: (token: string) => get(`/share/${encodeURIComponent(token)}`)
  };
}
