export const ACTIONS = {
  USER_MANAGE: "users.manage",
  USER_VIEW: "users.view",
  SETTINGS_EDIT: "settings.edit",
  SETTINGS_VIEW: "settings.view",
  TYPES_MANAGE: "types.manage",
  COLLECTIONS_MANAGE: "collections.manage",
  VOCABULARY_MANAGE: "vocabulary.manage",
  HTAGS_MANAGE: "htags.manage",
  VIDEO_CREATE: "videos.create",
  VIDEO_UPDATE: "videos.update",
  VIDEO_DELETE: "videos.delete",
  VIDEO_RESTORE: "videos.restore",
  VIDEO_BULK_DELETE: "videos.bulkDelete",
  VIDEO_VIEW: "videos.view",
  COMMENT_CREATE: "comments.create",
  COMMENT_DELETE: "comments.delete",
  DATA_EXPORT: "data.export",
  DATA_IMPORT: "data.import",
  DATA_REPLACE_ALL: "data.replaceAll",
  BACKUP_CREATE: "backup.create",
  BACKUP_RESTORE: "backup.restore",
  AUDIT_VIEW: "audit.view",
  HISTORY_CLEAR: "history.clear"
} as const;

export type PermissionId = typeof ACTIONS[keyof typeof ACTIONS];
export type UserRoleName = "admin" | "editor" | "viewer";

export interface PermissionUser {
  role?: string;
  isActive?: boolean;
  username?: string;
}

interface PermissionErrorMeta {
  action?: string;
  role?: string;
  username?: string;
}

const ADMIN_ACTIONS = new Set<PermissionId>(Object.values(ACTIONS));
const EDITOR_ACTIONS = new Set<PermissionId>([
  ACTIONS.USER_VIEW,
  ACTIONS.SETTINGS_VIEW,
  ACTIONS.TYPES_MANAGE,
  ACTIONS.COLLECTIONS_MANAGE,
  ACTIONS.VOCABULARY_MANAGE,
  ACTIONS.HTAGS_MANAGE,
  ACTIONS.VIDEO_CREATE,
  ACTIONS.VIDEO_UPDATE,
  ACTIONS.VIDEO_DELETE,
  ACTIONS.VIDEO_RESTORE,
  ACTIONS.VIDEO_BULK_DELETE,
  ACTIONS.VIDEO_VIEW,
  ACTIONS.COMMENT_CREATE,
  ACTIONS.COMMENT_DELETE,
  ACTIONS.DATA_EXPORT,
  ACTIONS.AUDIT_VIEW
]);
const VIEWER_ACTIONS = new Set<PermissionId>([
  ACTIONS.VIDEO_VIEW,
  ACTIONS.COMMENT_CREATE,
  ACTIONS.SETTINGS_VIEW,
  ACTIONS.DATA_EXPORT,
  ACTIONS.AUDIT_VIEW
]);

const ROLE_ACTIONS: Record<UserRoleName, Set<PermissionId>> = {
  admin: ADMIN_ACTIONS,
  editor: EDITOR_ACTIONS,
  viewer: VIEWER_ACTIONS
};

export function getEffectiveRole(user: PermissionUser | null | undefined): UserRoleName {
  if (!user || !user.role) return "viewer";
  return ROLE_ACTIONS[user.role as UserRoleName] ? (user.role as UserRoleName) : "viewer";
}

export function canPerform(user: PermissionUser | null | undefined, action: string | null | undefined): boolean {
  if (!user) return false;
  if (user.isActive === false) return false;
  if (!action || typeof action !== "string") return false;
  const role = getEffectiveRole(user);
  return ROLE_ACTIONS[role]?.has(action as PermissionId) === true;
}

export function requirePermission(user: PermissionUser | null | undefined, action: string): true {
  if (canPerform(user, action)) return true;
  const role = getEffectiveRole(user);
  const username = user?.username || "غير معروف";
  const error = new PermissionError(`صلاحية مرفوضة: لا يمكن لدور "${role}" تنفيذ "${action}".`, { action, role, username });
  throw error;
}

export class PermissionError extends Error {
  action: string | null;
  role: string | null;
  username: string | null;

  constructor(message: string, meta: PermissionErrorMeta = {}) {
    super(message);
    this.name = "PermissionError";
    this.action = meta.action || null;
    this.role = meta.role || null;
    this.username = meta.username || null;
  }
}

export function listActionsForRole(role: string): PermissionId[] {
  const allowed = ROLE_ACTIONS[role as UserRoleName] || ROLE_ACTIONS.viewer;
  return Array.from(allowed);
}
