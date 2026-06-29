/**
 * roles.ts — RBAC role definitions and permission checks
 *
 * Roles (highest to lowest privilege):
 *   admin  — full access, user management, system config
 *   editor — own records CRUD, search, export, tagging
 *   viewer — read-only: get, getAll, search, export; no write ops
 */

type Role = "admin" | "editor" | "viewer";

export const ROLES: readonly Role[] = ["admin", "editor", "viewer"];

interface UserWithRole {
  role?: string;
  isAdmin?: boolean;
  [key: string]: any;
}

/** RPC methods allowed per role (cumulative: each role gets its tier + all lower tiers) */
const VIEWER_METHODS = new Set([
  "open", "get", "getAll", "getByField", "snapshot",
]);

const EDITOR_METHODS = new Set([
  ...VIEWER_METHODS,
  "put", "add", "delete", "putBatch", "deleteBatch", "replaceAll", "clear",
]);

const ADMIN_METHODS = new Set([
  ...EDITOR_METHODS,
  // admin can do everything editors can + no additional RPC needed (admin REST routes handled separately)
]);

const ROLE_METHODS: Record<string, Set<string>> = {
  admin: ADMIN_METHODS,
  editor: EDITOR_METHODS,
  viewer: VIEWER_METHODS,
};

/**
 * Check if a user can call a specific RPC method.
 */
export function canCallRpc(user: UserWithRole | null, method: string): boolean {
  if (!user) return false;
  // Legacy: isAdmin flag → treat as admin role
  const role = user.role ?? (user.isAdmin ? "admin" : "editor");
  const allowed = ROLE_METHODS[role] ?? VIEWER_METHODS;
  return allowed.has(method);
}

/**
 * Check if a user has at least a minimum role.
 * Lower index in ROLES = higher privilege (admin=0, editor=1, viewer=2).
 */
export function hasRole(user: UserWithRole | null, minRole: string): boolean {
  if (!user) return false;
  const role = user.role ?? (user.isAdmin ? "admin" : "editor");
  const idx = ROLES.indexOf(role as Role);
  const minIdx = ROLES.indexOf(minRole as Role);
  if (idx === -1 || minIdx === -1) return false;
  return idx <= minIdx; // lower index = higher privilege
}

/**
 * Get effective role from user object (handles legacy isAdmin flag).
 */
export function getRole(user: UserWithRole | null): string {
  if (!user) return "viewer";
  return user.role ?? (user.isAdmin ? "admin" : "editor");
}
