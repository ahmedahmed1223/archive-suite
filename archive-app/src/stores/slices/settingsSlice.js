import { SHORTCUT_ACTIONS, SHORTCUT_DISABLED } from "../../features/settings/keyboardShortcuts.js";
import { STORES, dbPut } from "../../services/storageAccess.js";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../../utils/passwordHash.js";
import { nowIso } from "../storeCore.js";
import { defaultSettings, mergeSettings } from "../settingsDefaults.js";
import { normalizeUser } from "../storeModels.js";
import { persistSettings } from "../storePersistence.js";

export const INDEXEDDB_SOURCE_OF_TRUTH_MESSAGE = "SQLite غير مفعّل في هذه النسخة، التخزين المحلي يعمل عبر IndexedDB.";

export const settingsInitialState = {
  isPasswordSet: false,
  sqliteReady: false,
  sqliteError: null,
  settings: defaultSettings()
};

export const settingsActionKeys = [
  "updateSettings",
  "setMasterPassword",
  "skipPasswordSetup",
  "runSystemHealthCheck",
  "resetKeyboardShortcuts",
  "disableAllKeyboardShortcuts"
];

export function createSettingsActions({ set, get, getAuthStore }) {
  return {
    updateSettings: async (patch = {}) => {
      const settings = mergeSettings(get().settings, patch);
      set({ settings, isPasswordSet: get().isPasswordSet || !!settings.masterPasswordHash });
      await persistSettings(settings);
      return settings;
    },
    setMasterPassword: async (password) => {
      const policyErrors = validatePasswordStrength(password);
      if (policyErrors.length > 0) {
        get().showToast?.(policyErrors[0], "error");
        return false;
      }
      const passwordHashValue = await hashPassword(password);
      // Both stores get the same bcrypt hash so verifyPassword works against either.
      const settings = mergeSettings(get().settings, { masterPasswordHash: passwordHashValue, onboardingRequired: false, initialAdminPassword: null });
      let users = get().users;
      let admin = users.find((user) => user.username === "admin");
      if (admin) {
        admin = { ...admin, passwordHash: passwordHashValue, role: "admin", isActive: true, mustChangePassword: false, updatedAt: nowIso() };
        users = users.map((user) => user.id === admin.id ? admin : user);
      } else {
        admin = normalizeUser({ username: "admin", displayName: "المدير", role: "admin", passwordHash: passwordHashValue, isActive: true });
        users = [admin, ...users];
      }
      set({ settings, users, isPasswordSet: true, isLocked: false });
      await persistSettings(settings);
      await dbPut(STORES.USERS, admin);
      return true;
    },
    skipPasswordSetup: async () => {
      // Quick mode is retained for first-run demo but the admin is flagged
      // mustChangePassword=true and given an empty passwordHash. Login is
      // blocked for empty hashes (see authSlice.login), so the user can
      // browse the app while logged-in via initAuth from a fresh session
      // but cannot sign in again until they set a real password. This
      // preserves the workflow while removing the auth bypass.
      const settings = mergeSettings(get().settings, { ui: { onboardingSecurityMode: "quick", v1OnboardingCompleted: true }, onboardingRequired: false });
      let users = get().users;
      if (!users.some((user) => user.username === "admin")) {
        users = [normalizeUser({ username: "admin", displayName: "المدير", role: "admin", passwordHash: "", isActive: true, mustChangePassword: true }), ...users];
        await dbPut(STORES.USERS, users[0]);
      }
      set({ settings, users, isPasswordSet: false, isLocked: false });
      const quickUser = users.find((user) => user.username === "admin" && user.isActive !== false) || users.find((user) => user.isActive !== false);
      if (quickUser) {
        getAuthStore?.()?.setState?.({
          currentUser: quickUser,
          isAuthenticated: true,
          authError: null,
          mustChangePassword: !!quickUser.mustChangePassword
        });
        set({ currentUser: quickUser });
      }
      await persistSettings(settings);
      return true;
    },
    unlockApp: async (password) => {
      const masterHash = get().settings.masterPasswordHash;
      // No master password set → unlock is a no-op success (covers fresh quick-mode installs).
      if (!masterHash) {
        set({ isLocked: false });
        return true;
      }
      const ok = await verifyPassword(password, masterHash);
      if (ok) set({ isLocked: false });
      return ok;
    },
    lockApp: () => set({ isLocked: true }),
    runSystemHealthCheck: async () => {
      const indexedDbReady = typeof indexedDB !== "undefined";
      const checks = [
        { id: "indexeddb", label: "IndexedDB", status: indexedDbReady ? "ok" : "error", message: indexedDbReady ? "جاهز ومصدر التخزين الأساسي" : "غير متاح" },
        { id: "sqlite", label: "SQLite", status: "warning", message: INDEXEDDB_SOURCE_OF_TRUTH_MESSAGE },
        { id: "items", label: "العناصر", status: "ok", message: `${get().videoItems.length} عنصر` }
      ];
      const settings = mergeSettings(get().settings, { systemHealth: { lastCheckAt: nowIso(), checks } });
      set({ settings, sqliteReady: false, sqliteError: null });
      await persistSettings(settings);
      get().showToast("اكتمل فحص النظام", "success");
      return checks;
    },
    resetKeyboardShortcuts: async () => get().updateSettings({ keyboardShortcuts: {} }),
    disableAllKeyboardShortcuts: async () => get().updateSettings({
      keyboardShortcuts: Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action.id, SHORTCUT_DISABLED]))
    })
  };
}
