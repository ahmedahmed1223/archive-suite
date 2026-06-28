import { useAppStore } from "../stores/index.js";

type Role = "admin" | "editor" | "viewer";

interface CurrentUser {
  role?: Role;
  isAdmin?: boolean;
}

interface RoleState {
  role: Role;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  canEdit: boolean;
  canAdmin: boolean;
}

export function useRole(): RoleState {
  const user = useAppStore((s: { currentUser?: CurrentUser | null }) => s.currentUser);
  const role: Role = user?.role ?? (user?.isAdmin ? "admin" : "editor");

  return {
    role,
    isAdmin: role === "admin",
    isEditor: role === "admin" || role === "editor",
    isViewer: true,
    canEdit: role === "admin" || role === "editor",
    canAdmin: role === "admin",
  };
}
