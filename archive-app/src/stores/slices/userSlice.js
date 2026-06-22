import {
  STORES,
  dbPut
} from "../../services/storageAccess.js";
import { nowIso } from "../storeCore.js";
import { normalizeUser } from "../storeModels.js";
import { undoRedoManager } from "../../components/common/undoManager.js";
import { ACTIONS, requirePermission } from "../../features/users/permissions.js";

/**
 * Slice-level permission guard. Reads currentUser from the auth store
 * and throws PermissionError if the action isn't allowed.
 */
function checkPermission(get, getAuthStore, action) {
  const user = getAuthStore().getState().currentUser;
  try {
    requirePermission(user, action);
    return true;
  } catch (error) {
    get().addAuditLog?.("permission.denied", null, "auth", {
      action,
      role: error.role,
      username: error.username
    });
    throw error;
  }
}

export const userInitialState = {
  users: [],
  currentUser: null
};

export const userActionKeys = [
  "addUser",
  "updateUser",
  "deleteUser"
];

export function createUserActions({ set, get, getAuthStore }) {
  return {
    addUser: async (user) => {
      checkPermission(get, getAuthStore, ACTIONS.USER_MANAGE);
      const value = normalizeUser(user);
      if (get().users.some((item) => item.username.toLowerCase() === value.username.toLowerCase())) return false;
      set((state) => ({ users: [...state.users, value] }));
      await dbPut(STORES.USERS, value);
      get().addAuditLog?.("user.create", value.id, "user", { username: value.username, role: value.role });
      return value;
    },

    updateUser: async (user) => {
      const updated = normalizeUser(user);
      set((state) => ({
        users: state.users.map((item) => item.id === updated.id ? updated : item),
        currentUser: state.currentUser?.id === updated.id ? updated : state.currentUser
      }));
      await dbPut(STORES.USERS, updated);
      if (getAuthStore().getState().currentUser?.id === updated.id) {
        getAuthStore().setState({ currentUser: updated });
      }
      return updated;
    },

    deleteUser: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.USER_MANAGE);
      const target = get().users.find((item) => item.id === id);
      if (!target) return false;
      const wasActive = target.isActive !== false;
      const updated = { ...target, isActive: false, updatedAt: nowIso() };
      const result = await get().updateUser(updated);
      if (wasActive) {
        get().addAuditLog?.("user.deactivate", id, "user", { username: target.username });
      }
      if (!options.skipUndo && wasActive) {
        const label = `تعطيل ${target.displayName || target.username || "المستخدم"}`;
        undoRedoManager.push({
          label,
          undo: async () => {
            await get().updateUser({ ...target, isActive: true });
          },
          redo: () => get().deleteUser(id, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "info",
          title: "تم التعطيل",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return result;
    }
  };
}
