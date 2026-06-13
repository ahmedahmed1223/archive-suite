const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function nowIso() {
  return new Date().toISOString();
}

function generateLocalId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a normalized draft value (a snapshot of form state).
 * @param {Object} partial
 * @returns {Object}
 */
export function createDraft(partial = {}) {
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

/**
 * Creates a normalized work session value.
 * @param {Object} partial
 * @returns {Object}
 */
export function createWorkSession(partial = {}) {
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

/**
 * Creates a normalized bulk-progress value for long-running operations.
 * @param {Object} partial
 * @returns {Object}
 */
export function createBulkProgress(partial = {}) {
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

/**
 * Returns true if the draft is expired (now is past its expiresAt).
 * @param {Object} draft
 * @returns {boolean}
 */
export function isDraftExpired(draft) {
  if (!draft || !draft.expiresAt) return false;
  const expiry = new Date(draft.expiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return Date.now() > expiry;
}

export { DRAFT_TTL_MS, SESSION_PAGES, BULK_STATUSES };
