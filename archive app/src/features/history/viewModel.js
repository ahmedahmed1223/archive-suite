import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const HISTORY_ACTIONS = [
  { id: "create", label: "إنشاء", tone: "emerald" },
  { id: "update", label: "تحديث", tone: "blue" },
  { id: "delete", label: "حذف", tone: "red" },
  { id: "restore", label: "استعادة", tone: "amber" }
];

const HISTORY_ACTION_IDS = new Set(HISTORY_ACTIONS.map((action) => action.id));
const HISTORY_PAGE_SIZES = new Set([20, 50, 100]);

export function normalizeHistoryAction(action = "all") {
  return HISTORY_ACTION_IDS.has(action) ? action : "all";
}

export function normalizeHistoryPageSize(pageSize = 50) {
  const value = Number(pageSize);
  return HISTORY_PAGE_SIZES.has(value) ? value : 50;
}

export function normalizeHistoryPage(page = 1) {
  const value = Number(page);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function createHistoryRouteParams({
  query = "",
  action = "all",
  page = 1,
  pageSize = 50
} = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const normalizedAction = normalizeHistoryAction(action);
  if (normalizedAction !== "all") params.set("action", normalizedAction);
  const normalizedPage = normalizeHistoryPage(page);
  if (normalizedPage > 1) params.set("page", String(normalizedPage));
  const normalizedPageSize = normalizeHistoryPageSize(pageSize);
  if (normalizedPageSize !== 50) params.set("per", String(normalizedPageSize));
  return params;
}

export function parseHistoryRouteParams(params = new URLSearchParams()) {
  return {
    query: params.get("q") || "",
    action: normalizeHistoryAction(params.get("action") || "all"),
    page: normalizeHistoryPage(params.get("page") || 1),
    pageSize: normalizeHistoryPageSize(params.get("per") || 50)
  };
}

export function getHistoryActionLabel(action = "") {
  return HISTORY_ACTIONS.find((item) => item.id === action)?.label || action || "نشاط";
}

export function getHistoryActionTone(action = "") {
  return HISTORY_ACTIONS.find((item) => item.id === action)?.tone || "slate";
}

export function getHistoryRecordTimestamp(record = {}) {
  return record.timestamp || record.createdAt || "";
}

export function formatHistoryValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getFilteredHistoryRecords({
  changeHistory = [],
  query = "",
  action = "all",
  itemTitleById = new Map()
} = {}) {
  const normalizedAction = normalizeHistoryAction(action);
  const normalizedQuery = normalizeArabicSearchText(query);

  return [...changeHistory]
    .filter((record) => normalizedAction === "all" || record.action === normalizedAction)
    .filter((record) => {
      if (!normalizedQuery) return true;
      const itemTitle = itemTitleById.get(record.itemId) || record.itemTitle || record.itemId || "";
      return [
        getHistoryActionLabel(record.action),
        record.action,
        record.field,
        itemTitle,
        record.userId,
        formatHistoryValue(record.oldValue),
        formatHistoryValue(record.newValue)
      ].some((value) => normalizeArabicSearchText(value).includes(normalizedQuery));
    })
    .sort((a, b) => new Date(getHistoryRecordTimestamp(b) || 0).getTime() - new Date(getHistoryRecordTimestamp(a) || 0).getTime());
}

export function getHistoryActionCounts(changeHistory = []) {
  const counts = { all: changeHistory.length };
  HISTORY_ACTIONS.forEach((action) => {
    counts[action.id] = changeHistory.filter((record) => record.action === action.id).length;
  });
  return counts;
}
