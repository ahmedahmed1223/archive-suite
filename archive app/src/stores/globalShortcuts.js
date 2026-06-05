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
  "logout",
  "lockApp",
  "undo",
  "redo",
  "viewGrid",
  "viewList",
  "viewTable",
  "deleteSelected",
  "goBack"
];

export const INPUT_SAFE_GLOBAL_SHORTCUTS = [
  "showShortcuts",
  "openCommandPalette"
];

export function getGlobalShortcutAction(event, settings = {}, options = {}) {
  const isInput = options.isTextEntryTarget ?? isTextEntryTarget(event?.target);
  const safeActions = new Set(options.inputSafeActions || INPUT_SAFE_GLOBAL_SHORTCUTS);
  const actionOrder = options.actionOrder || GLOBAL_SHORTCUT_ACTION_ORDER;

  for (const actionId of actionOrder) {
    if (isInput && !safeActions.has(actionId)) continue;
    if (shortcutMatches(event, getShortcutValue(settings, actionId))) {
      return actionId;
    }
  }

  return null;
}
