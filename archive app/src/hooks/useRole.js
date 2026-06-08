import { useAppStore } from "../stores/index.js";

/**
 * useRole — returns the current user's role and permission helpers.
 *
 * Handles both the new `role` field and the legacy `isAdmin` boolean flag so
 * accounts created before the RBAC upgrade continue to work correctly.
 *
 * @returns {{
 *   role: "admin"|"editor"|"viewer",
 *   isAdmin: boolean,
 *   isEditor: boolean,
 *   isViewer: boolean,
 *   canEdit: boolean,
 *   canAdmin: boolean,
 * }}
 */
export function useRole() {
  const user = useAppStore((s) => s.currentUser);
  const role = user?.role ?? (user?.isAdmin ? "admin" : "editor");

  return {
    role,
    isAdmin: role === "admin",
    isEditor: role === "admin" || role === "editor",
    isViewer: true, // everyone can view
    canEdit: role === "admin" || role === "editor",
    canAdmin: role === "admin",
  };
}
