import { SHORTCUT_DISABLED } from "../../features/settings/keyboardShortcuts.js";
import { normalizeArabicSearchText } from "../../utils/formatting.js";

type ShortcutAction = {
  id: string;
  defaultKeys?: string;
  label?: string;
  category?: string;
};

type ShortcutDialogItem = {
  id: string;
  keys?: string;
  description?: string;
  category?: string;
};

export function createShortcutDialogItems(shortcutActions: ShortcutAction[] = []): ShortcutDialogItem[] {
  return shortcutActions.map((action) => ({
    id: action.id,
    keys: action.defaultKeys,
    description: action.label,
    category: action.category
  }));
}

export function filterShortcutDialogItems(
  items: ShortcutDialogItem[] = [],
  query = "",
  effectiveShortcuts: Record<string, string> = {}
): ShortcutDialogItem[] {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return items;
  return items.filter((shortcut) => {
    const haystack = normalizeArabicSearchText(
      `${shortcut.description || ""} ${shortcut.category || ""} ${effectiveShortcuts[shortcut.id] || ""}`
    );
    return haystack.includes(normalizedQuery);
  });
}

export function getShortcutDialogCategories(items: ShortcutDialogItem[] = []): string[] {
  return [...new Set(items.map((shortcut) => shortcut.category).filter((category): category is string => Boolean(category)))];
}

export function getShortcutDialogItemsForCategory(
  shortcutActions: ShortcutAction[] = [],
  visibleItems: ShortcutDialogItem[] = [],
  category?: string
): ShortcutAction[] {
  const visibleIds = new Set(visibleItems.map((shortcut) => shortcut.id));
  return shortcutActions.filter((action) => action.category === category && visibleIds.has(action.id));
}

export function formatShortcutDialogValue(value?: string, disabledToken = SHORTCUT_DISABLED): string {
  return value === disabledToken ? "معطّل" : value || "";
}
