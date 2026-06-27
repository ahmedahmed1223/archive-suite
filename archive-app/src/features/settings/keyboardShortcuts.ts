import { getEffectiveKeyboardShortcuts as getEffectiveKeyboardShortcutsUtil } from "../../utils/settings.js";

export const SHORTCUT_DISABLED = "disabled";

type ShortcutMap = Record<string, string>;

interface ShortcutSettings {
  keyboardShortcuts?: ShortcutMap;
  [key: string]: unknown;
}

interface ShortcutImportPayload {
  keyboardShortcuts?: ShortcutMap;
  [key: string]: unknown;
}

interface ShortcutEventLike {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  key?: string;
}

interface TextEntryTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

export const SHORTCUT_ACTIONS = [
  { id: "openSearch", label: "فتح البحث المتقدم", category: "التنقل", defaultKeys: "Alt+K", options: ["Ctrl+K", "Alt+K", "disabled"] },
  { id: "quickAdd", label: "إنشاء سريع", category: "التنقل", defaultKeys: "Alt+A", options: ["Alt+A", "Ctrl+Shift+A", "disabled"] },
  { id: "showShortcuts", label: "عرض اختصارات لوحة المفاتيح", category: "التنقل", defaultKeys: "Ctrl+/", options: ["Ctrl+/", "Alt+/", "disabled"] },
  { id: "openCommandPalette", label: "فتح لوحة الأوامر", category: "التنقل", defaultKeys: "Ctrl+K", options: ["Ctrl+K", "Ctrl+P", "Alt+P", "disabled"] },
  { id: "toggleNotifications", label: "فتح مركز الإشعارات", category: "التنقل", defaultKeys: "Ctrl+Shift+M", options: ["Ctrl+Shift+M", "Alt+M", "disabled"] },
  { id: "openBackup", label: "فتح النسخ الاحتياطي", category: "التنقل", defaultKeys: "Ctrl+B", options: ["Ctrl+B", "Alt+B", "disabled"] },
  { id: "openDashboard", label: "فتح مركز التحكم", category: "التنقل", defaultKeys: "Ctrl+D", options: ["Ctrl+D", "Alt+D", "disabled"] },
  { id: "toggleFocusMode", label: "وضع التركيز", category: "العرض", defaultKeys: "F11", options: ["F11", "Alt+F", "disabled"] },
  { id: "undo", label: "تراجع عن آخر عملية", category: "التحرير", defaultKeys: "Ctrl+Z", options: ["Ctrl+Z", "Alt+Z", "disabled"] },
  { id: "redo", label: "إعادة العملية الأخيرة", category: "التحرير", defaultKeys: "Ctrl+Y", options: ["Ctrl+Y", "Ctrl+Shift+Z", "Alt+Y", "disabled"] },
  { id: "viewGrid", label: "عرض شبكي", category: "العرض", defaultKeys: "Ctrl+1", options: ["Ctrl+1", "Alt+1", "disabled"] },
  { id: "viewList", label: "عرض قائمة", category: "العرض", defaultKeys: "Ctrl+2", options: ["Ctrl+2", "Alt+2", "disabled"] },
  { id: "viewTable", label: "عرض جدول", category: "العرض", defaultKeys: "Ctrl+3", options: ["Ctrl+3", "Alt+3", "disabled"] },
  { id: "viewGallery", label: "عرض معرض", category: "العرض", defaultKeys: "Ctrl+4", options: ["Ctrl+4", "Alt+4", "disabled"] },
  { id: "viewKanban", label: "فتح لوحات المشاريع", category: "التنقل", defaultKeys: "Ctrl+5", options: ["Ctrl+5", "Alt+5", "disabled"] },
  { id: "deleteSelected", label: "حذف العناصر المحددة", category: "التحرير", defaultKeys: "Delete", options: ["Delete", "Ctrl+Delete", "disabled"] },
  { id: "lockApp", label: "قفل التطبيق", category: "الأمان", defaultKeys: "Ctrl+Shift+L", options: ["Ctrl+Shift+L", "Alt+L", "disabled"] },
  { id: "logout", label: "تسجيل الخروج", category: "الأمان", defaultKeys: "Ctrl+Alt+L", options: ["Ctrl+Alt+L", "disabled"] },
  { id: "goBack", label: "الرجوع داخل التطبيق", category: "التنقل", defaultKeys: "Escape", options: ["Escape", "Alt+ArrowLeft", "disabled"] }
];

export function getShortcutValue(settings: ShortcutSettings | undefined, id: string): string {
  const action = SHORTCUT_ACTIONS.find((item) => item.id === id);
  return settings?.keyboardShortcuts?.[id] || action?.defaultKeys || SHORTCUT_DISABLED;
}

export function getDefaultKeyboardShortcuts(): ShortcutMap {
  return Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action.id, action.defaultKeys || SHORTCUT_DISABLED]));
}

export function getEffectiveKeyboardShortcuts(settings: ShortcutSettings = {}): ShortcutMap {
  return getEffectiveKeyboardShortcutsUtil(settings) as ShortcutMap;
}

export function normalizeImportedKeyboardShortcuts(
  payload: ShortcutImportPayload | ShortcutMap = {},
  fallback: ShortcutMap = getDefaultKeyboardShortcuts()
): ShortcutMap {
  const source = payload?.keyboardShortcuts && typeof payload.keyboardShortcuts === "object"
    ? payload.keyboardShortcuts
    : payload;
  const next = { ...fallback };
  if (!source || typeof source !== "object" || Array.isArray(source)) return next;
  SHORTCUT_ACTIONS.forEach((action) => {
    const value = (source as ShortcutMap)[action.id];
    if (action.options.includes(value)) next[action.id] = value;
  });
  return next;
}

export function createShortcutExportPayload(settings: ShortcutSettings = {}, now = new Date().toISOString()) {
  return {
    version: 1,
    exportedAt: now,
    keyboardShortcuts: normalizeImportedKeyboardShortcuts(getEffectiveKeyboardShortcuts(settings))
  };
}

export function serializeShortcutExportPayload(settings: ShortcutSettings = {}, now?: string): string {
  return JSON.stringify(createShortcutExportPayload(settings, now), null, 2);
}

export function normalizeShortcutValue(value: unknown): string {
  const normalized = String(value || SHORTCUT_DISABLED).trim().toLowerCase();
  return normalized || SHORTCUT_DISABLED;
}

export function findShortcutConflict(shortcuts: ShortcutMap | undefined, actionId: string, value: unknown) {
  const normalizedValue = normalizeShortcutValue(value);
  if (!normalizedValue || normalizedValue === SHORTCUT_DISABLED) return null;
  return SHORTCUT_ACTIONS.find((action) => action.id !== actionId && normalizeShortcutValue(shortcuts?.[action.id]) === normalizedValue) || null;
}

export function getShortcutConflictDetails(shortcuts: ShortcutMap | undefined): Record<string, (typeof SHORTCUT_ACTIONS)[number]> {
  const conflicts: Record<string, (typeof SHORTCUT_ACTIONS)[number]> = {};
  SHORTCUT_ACTIONS.forEach((action) => {
    const conflict = findShortcutConflict(shortcuts, action.id, shortcuts?.[action.id]);
    if (conflict) conflicts[action.id] = conflict;
  });
  return conflicts;
}

export function normalizeShortcutToken(token: unknown): string {
  const value = String(token || "").trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower === "ctrl" || lower === "control" || lower === "cmd" || lower === "meta") return "ctrl";
  if (lower === "esc") return "escape";
  if (lower === "space") return " ";
  return lower;
}

export function shortcutMatches(event: ShortcutEventLike, shortcut: unknown): boolean {
  if (!shortcut || shortcut === SHORTCUT_DISABLED) return false;
  const parts = String(shortcut).split("+").map(normalizeShortcutToken).filter(Boolean);
  if (parts.length === 0) return false;
  const wantsCtrl = parts.includes("ctrl");
  const wantsShift = parts.includes("shift");
  const wantsAlt = parts.includes("alt");
  const mainKey = parts.find((part) => !["ctrl", "shift", "alt"].includes(part));
  if (!!(event.ctrlKey || event.metaKey) !== wantsCtrl) return false;
  if (!!event.shiftKey !== wantsShift) return false;
  if (!!event.altKey !== wantsAlt) return false;
  const eventKey = normalizeShortcutToken(event.key);
  return mainKey === eventKey;
}

export function isTextEntryTarget(target: TextEntryTargetLike | null | undefined): boolean {
  if (!target) return false;
  const tagName = String(target.tagName || "").toUpperCase();
  const editableRole = String(target.getAttribute?.("role") || "").toLowerCase();
  return tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable ||
    ["textbox", "searchbox", "combobox", "spinbutton"].includes(editableRole);
}
