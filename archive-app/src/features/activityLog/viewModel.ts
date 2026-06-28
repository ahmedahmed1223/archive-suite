import { normalizeArabicSearchText } from "../../utils/formatting.js";

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
} as const;

export const ACTIVITY_TARGET_TYPES = {
  ITEM: "item",
  COLLECTION: "collection",
  TYPE: "type",
  FOLDER: "folder",
  SETTINGS: "settings"
} as const;

export type ActivityActionId = typeof ACTIVITY_ACTIONS[keyof typeof ACTIVITY_ACTIONS];
export type ActivityTargetTypeId = typeof ACTIVITY_TARGET_TYPES[keyof typeof ACTIVITY_TARGET_TYPES];

export interface ActivityEntrySnapshot {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { before: unknown; after: unknown }> | null;
}

export interface ActivityEntryContext {
  page: string | null;
  searchQuery: string | null;
  filters: Record<string, unknown> | null;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string | null;
  sessionId: string | null;
  action: ActivityActionId;
  targetType: ActivityTargetTypeId;
  targetId: string | null;
  targetName: string;
  snapshot: ActivityEntrySnapshot;
  context: ActivityEntryContext;
  relatedIds: string[];
  undoable: boolean;
  undone: boolean;
  undoneBy: string | null;
  undoneAt: string | null;
  clientIp: string | null;
  userAgent: string | null;
}

const ACTION_SET = new Set<ActivityActionId>(Object.values(ACTIVITY_ACTIONS));
const TARGET_SET = new Set<ActivityTargetTypeId>(Object.values(ACTIVITY_TARGET_TYPES));
const ACTION_LABELS: Record<ActivityActionId, string> = {
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
const TARGET_LABELS: Record<ActivityTargetTypeId, string> = {
  [ACTIVITY_TARGET_TYPES.ITEM]: "عنصر",
  [ACTIVITY_TARGET_TYPES.COLLECTION]: "مجموعة",
  [ACTIVITY_TARGET_TYPES.TYPE]: "نوع",
  [ACTIVITY_TARGET_TYPES.FOLDER]: "مجلد",
  [ACTIVITY_TARGET_TYPES.SETTINGS]: "إعدادات"
};
const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function newActivityId(): string {
  return `activity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeContext(context: { page?: unknown; searchQuery?: unknown; filters?: unknown } = {}): ActivityEntryContext {
  return {
    page: context.page ? String(context.page) : null,
    searchQuery: context.searchQuery ? String(context.searchQuery) : null,
    filters: context.filters && typeof context.filters === "object" ? { ...(context.filters as Record<string, unknown>) } : null
  };
}

function normalizeSnapshot(snapshot: { before?: unknown; after?: unknown; diff?: unknown } = {}): ActivityEntrySnapshot {
  const before = snapshot.before && typeof snapshot.before === "object" ? (snapshot.before as Record<string, unknown>) : null;
  const after = snapshot.after && typeof snapshot.after === "object" ? (snapshot.after as Record<string, unknown>) : null;
  let diff = snapshot.diff && typeof snapshot.diff === "object" ? (snapshot.diff as ActivityEntrySnapshot["diff"]) : null;
  if (!diff && before && after) diff = buildDiff(before, after);
  return { before, after, diff };
}

export function createActivityEntry(partial: Partial<ActivityEntry> = {}): ActivityEntry {
  const action = ACTION_SET.has(partial.action as ActivityActionId) ? (partial.action as ActivityActionId) : ACTIVITY_ACTIONS.UPDATE;
  const targetType = TARGET_SET.has(partial.targetType as ActivityTargetTypeId) ? (partial.targetType as ActivityTargetTypeId) : ACTIVITY_TARGET_TYPES.ITEM;
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
    snapshot: normalizeSnapshot(partial.snapshot || {}),
    context: normalizeContext(partial.context || {}),
    relatedIds: Array.isArray(partial.relatedIds) ? [...partial.relatedIds] : [],
    undoable: partial.undoable === true,
    undone: partial.undone === true,
    undoneBy: partial.undoneBy || null,
    undoneAt: partial.undoneAt || null,
    clientIp: partial.clientIp || null,
    userAgent: partial.userAgent || null
  };
}

export function buildDiff(before: unknown, after: unknown): Record<string, { before: unknown; after: unknown }> {
  const safeBefore = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
  const safeAfter = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(safeBefore), ...Object.keys(safeAfter)]);
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    const prev = safeBefore[key];
    const next = safeAfter[key];
    if (!isEqual(prev, next)) {
      diff[key] = { before: prev === undefined ? null : prev, after: next === undefined ? null : next };
    }
  }
  return diff;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function describeActivity(entry: Pick<ActivityEntry, "action" | "targetType" | "targetName"> | null | undefined): string {
  if (!entry) return "";
  const actionLabel = ACTION_LABELS[entry.action as ActivityActionId] || "تغيير";
  const targetLabel = TARGET_LABELS[entry.targetType as ActivityTargetTypeId] || "عنصر";
  const name = String(entry.targetName || "").trim();
  const base = `تم ${actionLabel} ${targetLabel}`;
  return name ? `${base}: ${name}` : base;
}

export function filterActivityEntries(entries: ActivityEntry[] = [], filters: {
  action?: string;
  targetType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  undoable?: boolean;
  undone?: boolean;
  query?: string;
} = {}): ActivityEntry[] {
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

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayLabel(date: Date): string {
  const today = new Date();
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86400000);
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return `${date.getDate()} ${ARABIC_MONTHS[date.getMonth()]}`;
}

export function groupActivitiesByDay(entries: ActivityEntry[] = []): Array<{ date: string; label: string; entries: ActivityEntry[] }> {
  const list = Array.isArray(entries) ? entries : [];
  const groups = new Map<string, { date: string; label: string; entries: ActivityEntry[] }>();
  for (const entry of list) {
    const date = new Date(entry?.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    if (!groups.has(key)) {
      groups.set(key, { date: key, label: dayLabel(date), entries: [] });
    }
    groups.get(key)!.entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
