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

export interface RecordListPayload {
  records: ArchiveRecord[];
  nextCursor?: string | null;
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

export type MediaOperation = "thumbnail" | "transcode" | "transcription" | "ocr";
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

export interface CreateMediaJobPayload {
  recordId: string;
  operation: MediaOperation;
  sourcePath?: string;
  options?: Record<string, unknown>;
}

export interface UploadedRecord {
  id: string;
  uid?: string;
  title: string;
  fileName: string;
  filePath: string;
  checksum: string;
  source: "upload";
  createdAt?: string;
  updatedAt?: string;
}

export type ManagedUserRole = "admin" | "editor" | "viewer";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: ManagedUserRole;
  createdAt?: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: ManagedUserRole;
  expiresAt: string;
  createdAt?: string;
}

export interface ContentField {
  id: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "relation" | "checkbox";
  required?: boolean;
  options?: string[];
}

export interface ContentSubtype {
  id: string;
  name: string;
  fields?: ContentField[];
}

export interface ContentTypeRecord {
  uid: string;
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  description?: string;
  active?: boolean;
  subtypes: ContentSubtype[];
  fields: ContentField[];
  updatedAt?: string;
}

export interface SecuritySettings {
  accessTokenTtlMinutes: number;
  perUserRateLimit: number;
  webhookUrlAllowlist: string[];
  legacyPasswordUpgrade: boolean;
  cspPolicy: string;
  corsOrigins: string[];
}

export type OdbcProbeStatus = "disabled" | "missing-dsn" | "driver-unavailable" | "connected" | "failed";

export interface OdbcProbe {
  enabled: boolean;
  driverLoaded: boolean;
  dsn: string;
  status: OdbcProbeStatus;
  message?: string;
  error?: string;
  tables: string[];
}

export interface OdbcTablePreview {
  table: string;
  count: number;
  rows: Record<string, unknown>[];
}

export type OdbcWriteOperation = "insert" | "update" | "delete";

export interface OdbcWriteResult {
  table: string;
  operation: OdbcWriteOperation;
  affected: number;
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

export type ReviewLinkPermission = "view" | "comment";

export interface ReviewLinkMetadata {
  permission: ReviewLinkPermission;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewLinkDetails {
  mediaUid: string;
  review: ReviewLinkMetadata;
  comments: ReviewComment[];
}

export type CollaborationStatus = "active" | "viewing" | "reviewing" | "editing" | "idle";

export interface CollaborationParticipant {
  id: string;
  roomKey: string;
  userId: string;
  displayName: string;
  status: CollaborationStatus;
  resourceId?: string | null;
  cursor?: Record<string, unknown> | null;
  lastSeenAt?: string | null;
}

export interface CollaborationPresencePayload {
  roomKey: string;
  activeWindowSeconds: number;
  participants: CollaborationParticipant[];
}

export interface CollaborationLock {
  id: string;
  roomKey: string;
  resourceId: string;
  userId: string;
  displayName: string;
  expiresAt?: string | null;
  updatedAt?: string | null;
}

export interface CollaborationLocksPayload {
  roomKey: string;
  locks: CollaborationLock[];
}

export interface CollaborationDocument {
  roomKey: string;
  resourceId: string;
  content: string;
  version: number;
  updatedByDisplayName?: string | null;
  updatedAt?: string | null;
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
  records(params: { store: string; cursor?: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<RecordListPayload>>;
  bulkRecords(payload: { store: string; records: ArchiveRecord[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ count: number }>>;
  rights(itemId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: RightsRecord }>>;
  mediaJob(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  mediaJobs(params?: { status?: MediaJobStatus; recordId?: string; limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ jobs: MediaJob[] }>>;
  createMediaJob(payload: CreateMediaJobPayload, options?: AuthRequestOptions): Promise<ApiEnvelope<{ job: MediaJob }>>;
  ingestScan(payload?: { subdir?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ ingested: unknown[]; skipped: number }>>;
  uploadFile(file: File, params?: { folder?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ record: UploadedRecord }>>;
  share(token: string): Promise<ApiEnvelope<{ records: ArchiveRecord[]; scope: Record<string, unknown>; permission?: string }>>;
  files(params?: { q?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ files: ArchiveFile[] }>>;
  createShare(payload: { itemIds: string[]; permission?: string; expiresAt?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ token: string; url?: string }>>;
  getSecuritySettings(options?: AuthRequestOptions): Promise<ApiEnvelope<{ settings: SecuritySettings }>>;
  odbcStatus(options?: AuthRequestOptions): Promise<ApiEnvelope<{ odbc: OdbcProbe }>>;
  odbcTable(table: string, params?: { limit?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcTablePreview>>;
  odbcCreateRow(table: string, payload: { values: Record<string, unknown> }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcWriteResult>>;
  odbcUpdateRow(table: string, payload: { keyColumn: string; keyValue: unknown; values: Record<string, unknown> }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcWriteResult>>;
  odbcDeleteRow(table: string, payload: { keyColumn: string; keyValue: unknown }, options?: AuthRequestOptions): Promise<ApiEnvelope<OdbcWriteResult>>;
  reviewComments(mediaUid: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comments: ReviewComment[] }>>;
  createReviewComment(mediaUid: string, payload: { body: string; timecodeSeconds: number; annotation?: ReviewRect[] }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comment: ReviewComment }>>;
  updateReviewComment(id: string, payload: Partial<{ body: string; resolved: boolean }>, options?: AuthRequestOptions): Promise<ApiEnvelope<{ comment: ReviewComment }>>;
  reviewLink(token: string): Promise<ApiEnvelope<ReviewLinkDetails>>;
  createReviewLink(payload: { mediaUid: string; permission?: ReviewLinkPermission; expiresAt?: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ token: string; url?: string; path?: string; mediaUid: string; permission: ReviewLinkPermission; expiresAt?: string | null }>>;
  collaborationPresence(roomKey: string, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationPresencePayload>>;
  sendCollaborationHeartbeat(roomKey: string, payload?: { status?: CollaborationStatus; resourceId?: string; cursor?: Record<string, unknown> }, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationPresencePayload>>;
  collaborationLocks(roomKey: string, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationLocksPayload>>;
  acquireCollaborationLock(roomKey: string, payload: { resourceId: string; ttlSeconds?: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationLocksPayload & { lock: CollaborationLock }>>;
  releaseCollaborationLock(roomKey: string, payload: { resourceId: string }, options?: AuthRequestOptions): Promise<ApiEnvelope<CollaborationLocksPayload & { released: boolean }>>;
  collaborationDocument(roomKey: string, resourceId: string, options?: AuthRequestOptions): Promise<ApiEnvelope<{ roomKey: string; document: CollaborationDocument }>>;
  updateCollaborationDocument(roomKey: string, resourceId: string, payload: { content: string; version: number }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ roomKey: string; document: CollaborationDocument }>>;
  listUsers(options?: AuthRequestOptions): Promise<ApiEnvelope<{ users: ManagedUser[]; invitations: PendingInvitation[] }>>;
  inviteUser(payload: { email: string; role: ManagedUserRole }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ invitation: PendingInvitation; token: string }>>;
  updateUserRole(id: string, payload: { role: ManagedUserRole }, options?: AuthRequestOptions): Promise<ApiEnvelope<{ user: ManagedUser }>>;
  deleteUser(id: string, options?: AuthRequestOptions): Promise<ApiEnvelope>;
  acceptInvitation(token: string, payload: { name: string; password: string }): Promise<ApiEnvelope<{ user: ManagedUser }>>;
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
      method?: "GET" | "POST" | "PATCH" | "DELETE";
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

  const del = <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) =>
    request<T>(path, { method: "DELETE", body, accessToken: options?.accessToken });

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
    records: ({ store, cursor, limit = 50 }: { store: string; cursor?: string; limit?: number }, options?: AuthRequestOptions) => {
      const params = new URLSearchParams({ store, limit: String(limit) });
      if (cursor) params.set("cursor", cursor);
      return get<RecordListPayload>(`/records?${params.toString()}`, options);
    },
    bulkRecords: (payload: { store: string; records: ArchiveRecord[] }, options?: AuthRequestOptions) =>
      post<{ count: number }>("/records/bulk", payload, options),
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
    createMediaJob: (payload: CreateMediaJobPayload, options?: AuthRequestOptions) =>
      post<{ job: MediaJob }>("/media/jobs", payload, options),
    ingestScan: (payload?: { subdir?: string }, options?: AuthRequestOptions) =>
      post<{ ingested: unknown[]; skipped: number }>("/ingest/scan", payload, options),
    uploadFile: async (file: File, params?: { folder?: string }, options?: AuthRequestOptions) => {
      const formData = new FormData();
      formData.append("file", file);
      if (params?.folder) formData.set("folder", params.folder);

      const headers = new Headers({ Accept: "application/json" });
      if (options?.accessToken) {
        headers.set("Authorization", `Bearer ${options.accessToken}`);
      }

      const response = await fetchImpl(`${baseUrl}/uploads`, {
        method: "POST",
        headers,
        credentials: "include",
        body: formData
      });

      const payload = (await response.json().catch(() => ({
        ok: false,
        error: "Invalid JSON response from /uploads"
      }))) as ApiEnvelope<{ record: UploadedRecord }>;

      if (!response.ok && payload.ok !== false) {
        return { ok: false, error: `Request failed with status ${response.status}` } as ApiEnvelope<{ record: UploadedRecord }>;
      }

      return payload;
    },
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
    odbcStatus: (options?: AuthRequestOptions) =>
      get<{ odbc: OdbcProbe }>("/system/odbc", options),
    odbcTable: (table: string, params?: { limit?: number }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set("limit", String(params.limit));
      const query = queryParams.toString();
      return get<OdbcTablePreview>(`/system/odbc/tables/${encodeURIComponent(table)}${query ? `?${query}` : ""}`, options);
    },
    odbcCreateRow: (table: string, payload: { values: Record<string, unknown> }, options?: AuthRequestOptions) =>
      post<OdbcWriteResult>(`/system/odbc/tables/${encodeURIComponent(table)}/rows`, payload, options),
    odbcUpdateRow: (table: string, payload: { keyColumn: string; keyValue: unknown; values: Record<string, unknown> }, options?: AuthRequestOptions) =>
      patch<OdbcWriteResult>(`/system/odbc/tables/${encodeURIComponent(table)}/rows`, payload, options),
    odbcDeleteRow: (table: string, payload: { keyColumn: string; keyValue: unknown }, options?: AuthRequestOptions) =>
      del<OdbcWriteResult>(`/system/odbc/tables/${encodeURIComponent(table)}/rows`, payload, options),
    reviewComments: (mediaUid: string, options?: AuthRequestOptions) =>
      get<{ comments: ReviewComment[] }>(`/media/${encodeURIComponent(mediaUid)}/review-comments`, options),
    createReviewComment: (mediaUid: string, payload: { body: string; timecodeSeconds: number; annotation?: ReviewRect[] }, options?: AuthRequestOptions) =>
      post<{ comment: ReviewComment }>(`/media/${encodeURIComponent(mediaUid)}/review-comments`, payload, options),
    updateReviewComment: (id: string, payload: Partial<{ body: string; resolved: boolean }>, options?: AuthRequestOptions) =>
      patch<{ comment: ReviewComment }>(`/review-comments/${encodeURIComponent(id)}`, payload, options),
    reviewLink: (token: string) =>
      get<ReviewLinkDetails>(`/review-links/${encodeURIComponent(token)}`),
    createReviewLink: (payload: { mediaUid: string; permission?: ReviewLinkPermission; expiresAt?: string }, options?: AuthRequestOptions) =>
      post<{ token: string; url?: string; path?: string; mediaUid: string; permission: ReviewLinkPermission; expiresAt?: string | null }>(
        `/media/${encodeURIComponent(payload.mediaUid)}/review-links`,
        { permission: payload.permission, expiresAt: payload.expiresAt },
        options
      ),
    listUsers: (options?: AuthRequestOptions) =>
      get<{ users: ManagedUser[]; invitations: PendingInvitation[] }>("/users", options),
    inviteUser: (payload: { email: string; role: ManagedUserRole }, options?: AuthRequestOptions) =>
      post<{ invitation: PendingInvitation; token: string }>("/users", payload, options),
    updateUserRole: (id: string, payload: { role: ManagedUserRole }, options?: AuthRequestOptions) =>
      patch<{ user: ManagedUser }>(`/users/${encodeURIComponent(id)}`, payload, options),
    deleteUser: (id: string, options?: AuthRequestOptions) => del(`/users/${encodeURIComponent(id)}`, undefined, options),
    acceptInvitation: (token: string, payload: { name: string; password: string }) =>
      post<{ user: ManagedUser }>(`/invitations/${encodeURIComponent(token)}/accept`, payload),
    collaborationPresence: (roomKey: string, options?: AuthRequestOptions) =>
      get<CollaborationPresencePayload>(`/collaboration/rooms/${encodeURIComponent(roomKey)}/presence`, options),
    sendCollaborationHeartbeat: (
      roomKey: string,
      payload?: { status?: CollaborationStatus; resourceId?: string; cursor?: Record<string, unknown> },
      options?: AuthRequestOptions
    ) =>
      post<CollaborationPresencePayload>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/presence`,
        payload,
        options
      ),
    collaborationLocks: (roomKey: string, options?: AuthRequestOptions) =>
      get<CollaborationLocksPayload>(`/collaboration/rooms/${encodeURIComponent(roomKey)}/locks`, options),
    acquireCollaborationLock: (roomKey: string, payload: { resourceId: string; ttlSeconds?: number }, options?: AuthRequestOptions) =>
      post<CollaborationLocksPayload & { lock: CollaborationLock }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/locks`,
        payload,
        options
      ),
    releaseCollaborationLock: (roomKey: string, payload: { resourceId: string }, options?: AuthRequestOptions) =>
      post<CollaborationLocksPayload & { released: boolean }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/locks/release`,
        payload,
        options
      ),
    collaborationDocument: (roomKey: string, resourceId: string, options?: AuthRequestOptions) =>
      get<{ roomKey: string; document: CollaborationDocument }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/documents/${encodeURIComponent(resourceId)}`,
        options
      ),
    updateCollaborationDocument: (
      roomKey: string,
      resourceId: string,
      payload: { content: string; version: number },
      options?: AuthRequestOptions
    ) =>
      post<{ roomKey: string; document: CollaborationDocument }>(
        `/collaboration/rooms/${encodeURIComponent(roomKey)}/documents/${encodeURIComponent(resourceId)}`,
        payload,
        options
      )
  };
}
