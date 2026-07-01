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

export interface ArchiveFile {
  key: string;
  name?: string;
  size?: number;
  modifiedAt?: string;
  store?: string;
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

export interface SecuritySettings {
  accessTokenTtlMinutes: number;
  perUserRateLimit: number;
  webhookUrlAllowlist: string[];
  legacyPasswordUpgrade: boolean;
  cspPolicy: string;
  corsOrigins: string[];
}

export interface ReviewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReviewComment {
  id: string;
  mediaUid: string;
  timecodeSeconds: number;
  author: string;
  body: string;
  annotation?: ReviewRect[] | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
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
  record(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: ArchiveRecord }>>;
  rights(itemId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: RightsRecord }>>;
  mediaJob(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  mediaJobs(params?: { status?: MediaJobStatus; recordId?: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ jobs: MediaJob[] }>>;
  createMediaJob(payload: { recordId: string; operation: MediaOperation; sourcePath?: string; options?: Record<string, unknown> }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  ingestScan(payload?: { subdir?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ ingested: unknown[]; skipped: number }>>;
  share(token: string): Promise<ApiEnvelope<{ records: ArchiveRecord[]; scope: Record<string, unknown>; permission?: string }>>;
  files(params?: { q?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ files: ArchiveFile[] }>>;
  createShare(payload: { itemIds: string[]; permission?: string; expiresAt?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ token: string; url?: string }>>;
  getSecuritySettings(options?: AuthRequestOptions): Promise<ApiEnvelope<{ settings: SecuritySettings }>>;
  reviewComments(mediaUid: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comments: ReviewComment[] }>>;
  createReviewComment(mediaUid: string, payload: { body: string; timecodeSeconds: number; annotation?: ReviewRect[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comment: ReviewComment }>>;
  updateReviewComment(id: string, payload: Partial<{ body: string; resolved: boolean }>, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comment: ReviewComment }>>;
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
      method?: "GET" | "POST" | "PATCH";
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

  const patch = <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) =>
    request<T>(path, { method: "PATCH", body, accessToken: options?.accessToken });

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
    record: (id: string, options?: AuthRequestOptions) => get<{ record: ArchiveRecord }>(`/records/${encodeURIComponent(id)}`, options),
    rights: (itemId: string, options?: AuthRequestOptions) => get<{ record: RightsRecord }>(`/rights?itemId=${encodeURIComponent(itemId)}`, options),
    mediaJob: (id: string, options?: AuthRequestOptions) => get<{ job: MediaJob }>(`/media/jobs/${encodeURIComponent(id)}`, options),
    mediaJobs: (params?: { status?: MediaJobStatus; recordId?: string; limit?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set("status", params.status);
      if (params?.recordId) queryParams.set("recordId", params.recordId);
      if (params?.limit) queryParams.set("limit", String(params.limit));
      const query = queryParams.toString();
      return get<{ jobs: MediaJob[] }>(`/media/jobs${query ? `?${query}` : ""}`, options);
    },
    createMediaJob: (payload: { recordId: string; operation: MediaOperation; sourcePath?: string; options?: Record<string, unknown> }, options?: AuthRequestOptions) =>
      post<{ job: MediaJob }>("/media/jobs", payload, options),
    ingestScan: (payload?: { subdir?: string }, options?: AuthRequestOptions) =>
      post<{ ingested: unknown[]; skipped: number }>("/ingest/scan", payload, options),
    share: (token: string) => get(`/share/${encodeURIComponent(token)}`),
    files: (params?: { q?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.q) queryParams.set("q", params.q);
      const query = queryParams.toString();
      return get<{ files: ArchiveFile[] }>(`/files${query ? `?${query}` : ""}`, options);
    },
    createShare: (payload: { itemIds: string[]; permission?: string; expiresAt?: string }, options?: AuthRequestOptions) =>
      post<{ token: string; url?: string }>("/share", { scope: { itemIds: payload.itemIds }, permission: payload.permission, expiresAt: payload.expiresAt }, options),
    getSecuritySettings: (options?: AuthRequestOptions) =>
      get<{ settings: SecuritySettings }>("/system/security-settings", options),
    reviewComments: (mediaUid: string, options?: AuthRequestOptions) =>
      get<{ comments: ReviewComment[] }>(`/media/${encodeURIComponent(mediaUid)}/review-comments`, options),
    createReviewComment: (mediaUid: string, payload: { body: string; timecodeSeconds: number; annotation?: ReviewRect[] }, options?: AuthRequestOptions) =>
      post<{ comment: ReviewComment }>(`/media/${encodeURIComponent(mediaUid)}/review-comments`, payload, options),
    updateReviewComment: (id: string, payload: Partial<{ body: string; resolved: boolean }>, options?: AuthRequestOptions) =>
      patch<{ comment: ReviewComment }>(`/review-comments/${encodeURIComponent(id)}`, payload, options)
  };
}
