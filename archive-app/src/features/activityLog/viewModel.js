import { normalizeArabicSearchText } from "../../utils/formatting.js";

// Activity action types
export const ACTIVITY_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  RESTORE: "restore",
  MOVE: "move",
  BULK_UPDATE: "bulk_update",
  BULK_DELETE: "bulk_delete",
  IMPORT: "import",
  EXPORT: "export"
};

// Activity target types
export const ACTIVITY_TARGET_TYPES = {
  ITEM: "item",
  COLLECTION: "collection",
  TYPE: "type",
  FOLDER: "folder",
  SETTINGS: "settings"
};

const ACTION_SET = new Set(Object.values(ACTIVITY_ACTIONS));
const TARGET_SET = new Set(Object.values(ACTIVITY_TARGET_TYPES));

const ACTION_LABELS = {
  [ACTIVITY_ACTIONS.CREATE]: "إنشاء",
  [ACTIVITY_ACTIONS.UPDATE]: "تعديل",
  [ACTIVITY_ACTIONS.DELETE]: "حذف",
  [ACTIVITY_ACTIONS.RESTORE]: "استعادة",
  [ACTIVITY_ACTIONS.MOVE]: "نقل",
  [ACTIVITY_ACTIONS.BULK_UPDATE]: "تعديل جماعي",
  [ACTIVITY_ACTIONS.BULK_DELETE]: "حذف جماعي",
  [ACTIVITY_ACTIONS.IMPORT]: "استيراد",
  [ACTIVITY_ACTIONS.EXPORT]: "تصدير"
};

const TARGET_LABELS = {
  [ACTIVITY_TARGET_TYPES.ITEM]: "عنصر",
  [ACTIVITY_TARGET_TYPES.COLLECTION]: "مجموعة",
  [ACTIVITY_TARGET_TYPES.TYPE]: "نوع",
  [ACTIVITY_TARGET_TYPES.FOLDER]: "مجلد",
  [ACTIVITY_TARGET_TYPES.SETTINGS]: "إعدادات"
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

function newActivityId() {
  return `activity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeContext(context = {}) {
  return {
    page: context.page ? String(context.page) : null,
    searchQuery: context.searchQuery ? String(context.searchQuery) : null,
    filters: context.filters && typeof context.filters === "object" ? { ...context.filters } : null
  };
}

function normalizeSnapshot(snapshot = {}) {
  const before = snapshot.before && typeof snapshot.before === "object" ? snapshot.before : null;
  const after = snapshot.after && typeof snapshot.after === "object" ? snapshot.after : null;
  let diff = snapshot.diff && typeof snapshot.diff === "object" ? snapshot.diff : null;
  if (!diff && before && after) diff = buildDiff(before, after);
  return { before, after, diff };
}

/**
 * Creates a normalized activity entry value object.
 * @param {Object} partial - partial activity entry data
 * @returns {Object} normalized activity entry
 */
export function createActivityEntry(partial = {}) {
  const action = ACTION_SET.has(partial.action) ? partial.action : ACTIVITY_ACTIONS.UPDATE;
  const targetType = TARGET_SET.has(partial.targetType) ? partial.targetType : ACTIVITY_TARGET_TYPES.ITEM;
  return {
    id: partial.id || newActivityId(),
    timestamp: partial.timestamp || new Date().toISOString(),
    userId: partial.userId || "system",
    userName: String(partial.userName || "النظام"),
    userRole: partial.userRole || null,
    sessionId: partial.sessionId || null,
    action,
    targetType,
    targetId: partial.targetId || null,
    targetName: String(partial.targetName || ""),
    snapshot: normalizeSnapshot(partial.snapshot),
    context: normalizeContext(partial.context),
    relatedIds: Array.isArray(partial.relatedIds) ? [...partial.relatedIds] : [],
    undoable: partial.undoable === true,
    undone: partial.undone === true,
    undoneBy: partial.undoneBy || null,
    undoneAt: partial.undoneAt || null,
    clientIp: partial.clientIp || null,
    userAgent: partial.userAgent || null
  };
}

/**
 * Computes a field-level diff between two objects.
 * Returns only changed fields: { fieldName: { before: oldVal, after: newVal } }
 */
export function buildDiff(before, after) {
  const safeBefore = before && typeof before === "object" ? before : {};
  const safeAfter = after && typeof after === "object" ? after : {};
  const keys = new Set([...Object.keys(safeBefore), ...Object.keys(safeAfter)]);
  const diff = {};
  for (const key of keys) {
    const prev = safeBefore[key];
    const next = safeAfter[key];
    if (!isEqual(prev, next)) {
      diff[key] = { before: prev === undefined ? null : prev, after: next === undefined ? null : next };
    }
  }
  return diff;
}

function isEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Returns a human-readable Arabic description for an activity entry.
 * Example: "تم إنشاء عنصر: عنوان الفيديو"
 */
export function describeActivity(entry) {
  if (!entry) return "";
  const actionLabel = ACTION_LABELS[entry.action] || "تغيير";
  const targetLabel = TARGET_LABELS[entry.targetType] || "عنصر";
  const name = String(entry.targetName || "").trim();
  const base = `تم ${actionLabel} ${targetLabel}`;
  return name ? `${base}: ${name}` : base;
}

/**
 * Filters activity entries by optional criteria.
 * filters: { action, targetType, userId, dateFrom, dateTo, undoable, undone, query }
 */
export function filterActivityEntries(entries = [], filters = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const fromTime = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const toTime = filters.dateTo ? new Date(filters.dateTo).getTime() : null;
  const query = filters.query ? normalizeArabicSearchText(filters.query) : "";
  return list.filter((entry) => {
    if (!entry) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.targetType && entry.targetType !== filters.targetType) return false;
    if (filters.userId && entry.userId !== filters.userId) return false;
    if (typeof filters.undoable === "boolean" && entry.undoable !== filters.undoable) return false;
    if (typeof filters.undone === "boolean" && entry.undone !== filters.undone) return false;
    if (fromTime !== null || toTime !== null) {
      const time = new Date(entry.timestamp).getTime();
      if (Number.isNaN(time)) return false;
      if (fromTime !== null && time < fromTime) return false;
      if (toTime !== null && time > toTime) return false;
    }
    if (query) {
      const haystack = [entry.targetName, describeActivity(entry), entry.userName].map(normalizeArabicSearchText);
      if (!haystack.some((value) => value.includes(query))) return false;
    }
    return true;
  });
}

function dayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayLabel(date) {
  const today = new Date();
  const startOf = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86400000);
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return `${date.getDate()} ${ARABIC_MONTHS[date.getMonth()]}`;
}

/**
 * Groups activity entries by ISO date (YYYY-MM-DD).
 * Returns array of { date: "2024-06-09", label: "اليوم"|"أمس"|"9 يونيو", entries: [...] }
 */
export function groupActivitiesByDay(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const groups = new Map();
  for (const entry of list) {
    const date = new Date(entry?.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    if (!groups.has(key)) {
      groups.set(key, { date: key, label: dayLabel(date), entries: [] });
    }
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
