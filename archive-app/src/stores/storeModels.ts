import { generateId, nowIso } from "./storeCore.js";

type RecordLike = Record<string, any>;

export function normalizeUser(user: RecordLike = {}) {
  const createdAt = user.createdAt || nowIso();
  return {
    id: user.id || generateId("user"),
    username: String(user.username || "admin").trim(),
    displayName: String(user.displayName || user.username || "المدير").trim(),
    passwordHash: user.passwordHash || "",
    role: user.role || "viewer",
    customPermissions: user.customPermissions,
    isActive: user.isActive !== false,
    lastLoginAt: user.lastLoginAt || null,
    mustChangePassword: !!user.mustChangePassword,
    createdAt,
    updatedAt: user.updatedAt || createdAt
  };
}

export function normalizeChangeRecord(record: RecordLike = {}) {
  return {
    ...record,
    id: record.id || generateId("history"),
    timestamp: record.timestamp || nowIso()
  };
}
