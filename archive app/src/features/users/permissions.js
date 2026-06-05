/**
 * Role-Based Access Control matrix.
 *
 * Each action is a stable string identifier used by slices to gate
 * mutations. The matrix maps role → set of allowed actions.
 *
 * Adding a new action:
 *   1. Add a constant to ARCHIVE_ACTIONS below.
 *   2. Add it to the roles that should be permitted in ROLE_ACTIONS.
 *   3. Call requirePermission(action) from the slice mutation.
 *
 * Display rules (which UI elements to show/hide) should reuse
 * canPerform() rather than hard-coding role string checks so future
 * matrix changes propagate everywhere automatically.
 */

export const ACTIONS = {
  // Users + auth
  USER_MANAGE: "users.manage",
  USER_VIEW: "users.view",

  // Settings
  SETTINGS_EDIT: "settings.edit",
  SETTINGS_VIEW: "settings.view",

  // Content taxonomy
  TYPES_MANAGE: "types.manage",
  COLLECTIONS_MANAGE: "collections.manage",
  VOCABULARY_MANAGE: "vocabulary.manage",
  HTAGS_MANAGE: "htags.manage",

  // Video items
  VIDEO_CREATE: "videos.create",
  VIDEO_UPDATE: "videos.update",
  VIDEO_DELETE: "videos.delete",
  VIDEO_RESTORE: "videos.restore",
  VIDEO_BULK_DELETE: "videos.bulkDelete",
  VIDEO_VIEW: "videos.view",

  // Item collaboration
  COMMENT_CREATE: "comments.create",
  COMMENT_DELETE: "comments.delete",

  // Data portability
  DATA_EXPORT: "data.export",
  DATA_IMPORT: "data.import",
  DATA_REPLACE_ALL: "data.replaceAll",
  BACKUP_CREATE: "backup.create",
  BACKUP_RESTORE: "backup.restore",

  // Audit + history
  AUDIT_VIEW: "audit.view",
  HISTORY_CLEAR: "history.clear"
};

const ADMIN_ACTIONS = new Set(Object.values(ACTIONS));

const EDITOR_ACTIONS = new Set([
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

const VIEWER_ACTIONS = new Set([
  ACTIONS.VIDEO_VIEW,
  ACTIONS.COMMENT_CREATE,
  ACTIONS.SETTINGS_VIEW,
  ACTIONS.DATA_EXPORT,
  ACTIONS.AUDIT_VIEW
]);

const ROLE_ACTIONS = {
  admin: ADMIN_ACTIONS,
  editor: EDITOR_ACTIONS,
  viewer: VIEWER_ACTIONS
};

/**
 * Resolve the active role for a user, falling back to the most
 * restrictive role for unknown values.
 */
export function getEffectiveRole(user) {
  if (!user || !user.role) return "viewer";
  return ROLE_ACTIONS[user.role] ? user.role : "viewer";
}

/**
 * Check whether the given user can perform the given action.
 * Returns false for missing user, inactive user, or unknown action.
 */
export function canPerform(user, action) {
  if (!user) return false;
  if (user.isActive === false) return false;
  if (!action || typeof action !== "string") return false;
  const role = getEffectiveRole(user);
  return ROLE_ACTIONS[role]?.has(action) === true;
}

/**
 * Throw a PermissionError if the user can't perform the action.
 * Used at the start of slice mutations. The thrown error carries the
 * action name + role so audit logging can record the attempt.
 */
export function requirePermission(user, action) {
  if (canPerform(user, action)) return true;
  const role = getEffectiveRole(user);
  const username = user?.username || "غير معروف";
  const error = new PermissionError(
    `صلاحية مرفوضة: لا يمكن لدور "${role}" تنفيذ "${action}".`,
    { action, role, username }
  );
  throw error;
}

/**
 * Distinguishable error class so callers can catch permission errors
 * separately from generic failures and surface them via reportError.
 */
export class PermissionError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = "PermissionError";
    this.action = meta.action || null;
    this.role = meta.role || null;
    this.username = meta.username || null;
  }
}

/**
 * Return the list of actions a role can perform. Useful for UI tests
 * and the Users page role detail card.
 */
export function listActionsForRole(role) {
  const allowed = ROLE_ACTIONS[role] || ROLE_ACTIONS.viewer;
  return Array.from(allowed);
}
