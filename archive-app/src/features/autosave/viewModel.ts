const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function generateLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type DraftValue = {
  id: string;
  key: string;
  formKey: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type WorkSessionValue = {
  id: string;
  page: string;
  scrollPosition: number;
  selectedId: string | null;
  filters: Record<string, any>;
  folderId: string | null;
  startedAt: string;
  updatedAt: string;
  isActive: boolean;
};

export type BulkProgressValue = {
  id: string;
  operation: string;
  total: number;
  processed: number;
  failed: number;
  status: string;
  failedIds: unknown[];
  startedAt: string;
  updatedAt: string;
};

export function createDraft(partial: Record<string, any> = {}): DraftValue {
  const now = nowIso();
  const createdAt = partial.createdAt || now;
  const expiresAt = partial.expiresAt || new Date(new Date(createdAt).getTime() + DRAFT_TTL_MS).toISOString();
  const key = String(partial.key || partial.id || generateLocalId("draft"));
  return {
    id: partial.id || key,
    key,
    formKey: String(partial.formKey || partial.key || ""),
    data: partial.data && typeof partial.data === "object" ? { ...partial.data } : {},
    createdAt,
    updatedAt: now,
    expiresAt
  };
}

const SESSION_PAGES = ["dashboard", "archive", "collections", "projects", "settings"];

export function createWorkSession(partial: Record<string, any> = {}): WorkSessionValue {
  const now = nowIso();
  const page = String(partial.page || "dashboard");
  return {
    id: partial.id || page,
    page,
    scrollPosition: Math.max(0, Number(partial.scrollPosition) || 0),
    selectedId: partial.selectedId || null,
    filters: partial.filters && typeof partial.filters === "object" ? { ...partial.filters } : {},
    folderId: partial.folderId || null,
    startedAt: partial.startedAt || now,
    updatedAt: now,
    isActive: partial.isActive !== false
  };
}

const BULK_STATUSES = ["pending", "running", "completed", "failed", "cancelled"];

export function createBulkProgress(partial: Record<string, any> = {}): BulkProgressValue {
  const now = nowIso();
  const total = Math.max(0, Number(partial.total) || 0);
  const processed = Math.min(total, Math.max(0, Number(partial.processed) || 0));
  const failed = Math.max(0, Number(partial.failed) || 0);
  const status = BULK_STATUSES.includes(partial.status) ? partial.status : "pending";
  return {
    id: partial.id || generateLocalId("bulk"),
    operation: String(partial.operation || ""),
    total,
    processed,
    failed,
    status,
    failedIds: Array.isArray(partial.failedIds) ? [...partial.failedIds] : [],
    startedAt: partial.startedAt || now,
    updatedAt: now
  };
}

export function isDraftExpired(draft: { expiresAt?: string } | null | undefined): boolean {
  if (!draft || !draft.expiresAt) return false;
  const expiry = new Date(draft.expiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return Date.now() > expiry;
}

export { DRAFT_TTL_MS, SESSION_PAGES, BULK_STATUSES };
