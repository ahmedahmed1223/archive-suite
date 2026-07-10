// ponytail: simple localStorage shortcut store; no complex event systems
// Upgrade path: subscribe to changes via window.dispatchEvent if multiple components need reactivity

export type ShortcutKey = "commandPalette";

interface ShortcutBinding {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

interface ShortcutsStore {
  commandPalette: ShortcutBinding;
}

const STORAGE_KEY = "archive:keyboard-shortcuts";

const defaultShortcuts: ShortcutsStore = {
  commandPalette: { key: "k", ctrlKey: true, metaKey: true }
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
    commandPalette: { label: "فتح لوحة الأوامر", binding: shortcuts.commandPalette }
  };
}

export function formatShortcutDisplay(binding: ShortcutBinding): string {
  const parts: string[] = [];
  if (binding.ctrlKey) parts.push("Ctrl");
  if (binding.metaKey) parts.push("Cmd");
  if (binding.shiftKey) parts.push("Shift");
  if (binding.altKey) parts.push("Alt");
  parts.push(binding.key.toUpperCase());
  return parts.join(" + ");
}

export function matchesKeyEvent(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  return (
    event.key.toLowerCase() === binding.key.toLowerCase() &&
    (binding.ctrlKey ? event.ctrlKey : !event.ctrlKey) &&
    (binding.metaKey ? event.metaKey : !event.metaKey) &&
    (binding.shiftKey ? event.shiftKey : !event.shiftKey) &&
    (binding.altKey ? event.altKey : !event.altKey)
  );
}
