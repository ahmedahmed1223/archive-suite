import { useAppStore, useAuthStore } from "../../stores/index.js";
import { canPerform } from "./permissions.js";

/**
 * Hook to check whether the active user can perform an RBAC action.
 *
 * Usage:
 *   const canDelete = useCanPerform(ACTIONS.VIDEO_DELETE);
 *   {canDelete && <button onClick={onDelete}>Delete</button>}
 *
 * Subscribes to the auth store so the UI reactively re-renders when
 * the user switches accounts or their role changes. Returns false
 * for guests so guard checks naturally short-circuit.
 */
export function useCanPerform(action) {
  // Both stores expose currentUser; prefer the auth store as the
  // authoritative source. Fall back to the app store for safety.
  const authUser = useAuthStore((state) => state.currentUser);
  const appUser = useAppStore((state) => state.currentUser);
  const user = authUser || appUser;
  return canPerform(user, action);
}
