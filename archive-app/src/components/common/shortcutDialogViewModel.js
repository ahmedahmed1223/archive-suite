import { SHORTCUT_DISABLED } from "../../features/settings/keyboardShortcuts.js";
import { normalizeArabicSearchText } from "../../utils/formatting.js";

export function createShortcutDialogItems(shortcutActions = []) {
  return shortcutActions.map((action) => ({
    id: action.id,
    keys: action.defaultKeys,
    description: action.label,
    category: action.category
  }));
}

export function filterShortcutDialogItems(items = [], query = "", effectiveShortcuts = {}) {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return items;
  return items.filter((shortcut) => {
    const haystack = normalizeArabicSearchText(
      `${shortcut.description || ""} ${shortcut.category || ""} ${effectiveShortcuts[shortcut.id] || ""}`
    );
    return haystack.includes(normalizedQuery);
  });
}

export function getShortcutDialogCategories(items = []) {
  return [...new Set(items.map((shortcut) => shortcut.category).filter(Boolean))];
}

export function getShortcutDialogItemsForCategory(shortcutActions = [], visibleItems = [], category) {
  const visibleIds = new Set(visibleItems.map((shortcut) => shortcut.id));
  return shortcutActions.filter((action) => action.category === category && visibleIds.has(action.id));
}

export function formatShortcutDialogValue(value, disabledToken = SHORTCUT_DISABLED) {
  return value === disabledToken ? "معطّل" : value || "";
}
