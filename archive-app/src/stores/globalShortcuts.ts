import {
  getShortcutValue,
  isTextEntryTarget,
  shortcutMatches
} from "../features/settings/keyboardShortcuts.js";

export const GLOBAL_SHORTCUT_ACTION_ORDER = [
  "showShortcuts",
  "openCommandPalette",
  "openSearch",
  "toggleNotifications",
  "openBackup",
  "openDashboard",
  "toggleFocusMode",
  "logout",
  "lockApp",
  "undo",
  "redo",
  "viewGrid",
  "viewList",
  "viewTable",
  "viewGallery",
  "viewKanban",
  "deleteSelected",
  "goBack"
];

export const INPUT_SAFE_GLOBAL_SHORTCUTS = [
  "showShortcuts",
  "openCommandPalette"
];

type ShortcutOptions = {
  isTextEntryTarget?: boolean;
  inputSafeActions?: string[];
  actionOrder?: string[];
};

type TextEntryTargetLike = {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
};

type ShortcutEventLike = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  key?: string;
};

export function getGlobalShortcutAction(
  event: KeyboardEvent | null | undefined,
  settings: Record<string, any> = {},
  options: ShortcutOptions = {}
) {
  if (!event) return null;
  const isInput = options.isTextEntryTarget ?? isTextEntryTarget(event.target as TextEntryTargetLike | null | undefined);
  const safeActions = new Set(options.inputSafeActions || INPUT_SAFE_GLOBAL_SHORTCUTS);
  const actionOrder = options.actionOrder || GLOBAL_SHORTCUT_ACTION_ORDER;

  for (const actionId of actionOrder) {
    if (isInput && !safeActions.has(actionId)) continue;
    if (shortcutMatches(event as ShortcutEventLike, getShortcutValue(settings, actionId))) {
      return actionId;
    }
  }

  return null;
}
