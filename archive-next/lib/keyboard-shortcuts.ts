// ponytail: simple localStorage shortcut store; no complex event systems
// Upgrade path: subscribe to changes via window.dispatchEvent if multiple components need reactivity

export type ShortcutKey =
  | "commandPalette"
  | "shortcutsHelp"
  | "focusSearch"
  | "newRecord"
  | "saveRecord"
  | "focusComments"
  | "focusTags";

/**
 * V1-832: single-key shortcuts must never fire while the user is typing.
 * ponytail: shared here rather than copied per component -- it used to live
 * privately in ShortcutsOverlay, so every new shortcut would have shipped
 * unguarded and swallowed a keystroke mid-sentence.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  // isContentEditable is the browser's answer but is not implemented
  // everywhere (jsdom returns undefined), so fall back to the attribute --
  // an editable region must never be treated as a safe place to fire a key.
  if (target.isContentEditable) return true;
  const attribute = target.getAttribute("contenteditable");
  return attribute !== null && attribute !== "false";
}

interface ShortcutBinding {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

type ShortcutsStore = Record<ShortcutKey, ShortcutBinding>;

const STORAGE_KEY = "archive:keyboard-shortcuts";

// Ctrl+S, Ctrl+N and friends are deliberately absent: V1-832 requires the
// shortcuts not to intercept browser shortcuts, so the single-key bindings
// carry the work and saving uses Ctrl+Enter, which no browser claims.
const defaultShortcuts: ShortcutsStore = {
  commandPalette: { key: "k", ctrlKey: true, metaKey: true },
  shortcutsHelp: { key: "?", shiftKey: true },
  focusSearch: { key: "/" },
  newRecord: { key: "n" },
  saveRecord: { key: "Enter", ctrlKey: true, metaKey: true },
  focusComments: { key: "c" },
  focusTags: { key: "t" }
};

function loadShortcuts(): ShortcutsStore {
  if (typeof window === "undefined") return defaultShortcuts;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultShortcuts;

  try {
    return { ...defaultShortcuts, ...JSON.parse(stored) };
  } catch {
    return defaultShortcuts;
  }
}

function saveShortcuts(shortcuts: ShortcutsStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  window.dispatchEvent(new Event("archive:shortcuts-changed"));
}

export function getShortcut(key: ShortcutKey): ShortcutBinding {
  return loadShortcuts()[key];
}

export function updateShortcut(key: ShortcutKey, binding: ShortcutBinding) {
  const current = loadShortcuts();
  current[key] = binding;
  saveShortcuts(current);
}

export function resetShortcuts() {
  saveShortcuts(defaultShortcuts);
}

export function getAllShortcuts(): Record<ShortcutKey, { label: string; binding: ShortcutBinding }> {
  const shortcuts = loadShortcuts();
  return {
    commandPalette: { label: "فتح لوحة الأوامر", binding: shortcuts.commandPalette },
    shortcutsHelp: { label: "عرض لوحة الاختصارات", binding: shortcuts.shortcutsHelp },
    focusSearch: { label: "الانتقال إلى البحث", binding: shortcuts.focusSearch },
    newRecord: { label: "إنشاء مادة جديدة", binding: shortcuts.newRecord },
    saveRecord: { label: "حفظ التوصيف", binding: shortcuts.saveRecord },
    focusComments: { label: "الانتقال إلى التعليقات", binding: shortcuts.focusComments },
    focusTags: { label: "الانتقال إلى الوسوم", binding: shortcuts.focusTags }
  };
}

export function formatShortcutDisplay(binding: ShortcutBinding): string {
  const parts: string[] = [];
  // A binding with both modifiers represents the platform-native pair:
  // Ctrl on Windows/Linux or Cmd on macOS. It must not require both keys.
  if (binding.ctrlKey && binding.metaKey) {
    parts.push("Ctrl / Cmd");
  } else if (binding.ctrlKey) {
    parts.push("Ctrl");
  } else if (binding.metaKey) {
    parts.push("Cmd");
  }
  if (binding.shiftKey) parts.push("Shift");
  if (binding.altKey) parts.push("Alt");
  parts.push(binding.key.toUpperCase());
  return parts.join(" + ");
}

export function matchesKeyEvent(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  const matchesPrimaryModifier = binding.ctrlKey && binding.metaKey
    ? event.ctrlKey || event.metaKey
    : (binding.ctrlKey ? event.ctrlKey : !event.ctrlKey) &&
      (binding.metaKey ? event.metaKey : !event.metaKey);

  return (
    event.key.toLowerCase() === binding.key.toLowerCase() &&
    matchesPrimaryModifier &&
    (binding.shiftKey ? event.shiftKey : !event.shiftKey) &&
    (binding.altKey ? event.altKey : !event.altKey)
  );
}
