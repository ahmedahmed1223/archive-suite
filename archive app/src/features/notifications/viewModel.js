import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const NOTIFICATION_CATEGORIES = ["system", "mention", "comment", "task", "share", "export"];

export const NOTIFICATION_CATEGORY_LABELS = {
  system: "النظام",
  mention: "إشارات",
  comment: "تعليقات",
  task: "مهام",
  share: "مشاركة",
  export: "تصدير"
};

const CATEGORY_SET = new Set(NOTIFICATION_CATEGORIES);
const TYPE_SET = new Set(["info", "success", "warning", "error"]);

export function normalizeNotification(input = {}) {
  const type = TYPE_SET.has(input.type) ? input.type : "info";
  const category = CATEGORY_SET.has(input.category) ? input.category : "system";
  return {
    ...input,
    type,
    category,
    title: String(input.title || (type === "error" ? "خطأ" : type === "warning" ? "تنبيه" : type === "success" ? "تم بنجاح" : "معلومة")),
    message: String(input.message || ""),
    createdAt: input.createdAt || new Date().toISOString(),
    readAt: input.readAt || null,
    archivedAt: input.archivedAt || null,
    targetLabel: String(input.targetLabel || ""),
    technicalDetails: input.technicalDetails ? String(input.technicalDetails) : ""
  };
}

export function getUnreadNotifications(history = []) {
  return (Array.isArray(history) ? history : []).map(normalizeNotification).filter((item) => !item.readAt && !item.archivedAt);
}

export function getNotificationCounts(history = []) {
  const counts = {
    all: 0,
    archived: 0,
    unread: 0,
    read: 0,
    system: 0,
    mention: 0,
    comment: 0,
    task: 0,
    share: 0,
    export: 0,
    success: 0,
    warning: 0,
    error: 0,
    info: 0
  };
  for (const raw of Array.isArray(history) ? history : []) {
    const item = normalizeNotification(raw);
    if (item.archivedAt) {
      counts.archived += 1;
      continue;
    }
    counts.all += 1;
    if (!item.readAt) counts.unread += 1;
    else counts.read += 1;
    if (counts[item.category] !== undefined) counts[item.category] += 1;
    if (counts[item.type] !== undefined) counts[item.type] += 1;
  }
  return counts;
}

export function filterNotifications(history = [], filter = "all", options = {}) {
  const opts = typeof filter === "object" && filter
    ? filter
    : { ...options, filter };
  const activeFilter = opts.filter || "all";
  const readState = opts.readState || "all";
  const query = normalizeArabicSearchText(opts.query || "");
  let items = (Array.isArray(history) ? history : []).map(normalizeNotification);
  if (activeFilter !== "archived") items = items.filter((item) => !item.archivedAt);
  if (activeFilter === "archived") items = items.filter((item) => item.archivedAt);
  if (activeFilter === "unread") items = items.filter((item) => !item.readAt);
  else if (activeFilter !== "all" && activeFilter !== "archived") {
    if (CATEGORY_SET.has(activeFilter)) items = items.filter((item) => item.category === activeFilter);
    if (TYPE_SET.has(activeFilter)) items = items.filter((item) => item.type === activeFilter);
  }
  if (readState === "read") items = items.filter((item) => item.readAt);
  if (readState === "unread") items = items.filter((item) => !item.readAt);
  if (query) {
    items = items.filter((item) => [
      item.title,
      item.message,
      item.targetLabel,
      item.category,
      item.type
    ].some((value) => normalizeArabicSearchText(value).includes(query)));
  }
  return items;
}

export function getNotificationDayBucket(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) return { id: "unknown", label: "بلا تاريخ" };
  const today = new Date();
  const startOf = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86400000);
  if (diffDays === 0) return { id: "today", label: "اليوم" };
  if (diffDays === 1) return { id: "yesterday", label: "أمس" };
  if (diffDays < 7) return { id: `days-${diffDays}`, label: `قبل ${diffDays} أيام` };
  return { id: date.toISOString().slice(0, 10), label: date.toLocaleDateString("ar") };
}

export function groupNotificationsByDay(history = [], filter = "all", options = {}) {
  const groups = new Map();
  for (const item of filterNotifications(history, filter, options)) {
    const bucket = getNotificationDayBucket(item.createdAt);
    if (!groups.has(bucket.id)) groups.set(bucket.id, { ...bucket, items: [] });
    groups.get(bucket.id).items.push(item);
  }
  return [...groups.values()];
}

export function shouldShowNotificationToast(settings = {}, notification = {}) {
  const prefs = settings.notifications || {};
  const category = notification.category || "system";
  const type = notification.type || "info";
  const muted = Array.isArray(prefs.mutedCategories) && prefs.mutedCategories.includes(category);
  const typeAllowed = prefs.toastByType?.[type] !== false;
  return !muted && typeAllowed;
}
