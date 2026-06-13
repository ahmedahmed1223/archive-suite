import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const USER_ROLES = [
  { id: "admin", label: "مدير", color: "#ef4444", description: "إدارة كاملة للتطبيق والبيانات." },
  { id: "editor", label: "محرر", color: "#10b981", description: "إضافة وتعديل العناصر بدون إدارة الأمان." },
  { id: "viewer", label: "مشاهد", color: "#3b82f6", description: "تصفح وبحث وقراءة فقط." }
];

const USER_ROLE_IDS = new Set(USER_ROLES.map((role) => role.id));
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

export function normalizeUserRole(role = "viewer") {
  return USER_ROLE_IDS.has(role) ? role : "viewer";
}

export function isValidInviteEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export function createTemporaryPassword(length = 16, randomValues = null) {
  const size = Math.max(12, Number(length) || 16);
  const bytes = new Uint8Array(size);
  if (typeof randomValues === "function") {
    randomValues(bytes);
  } else if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((byte) => TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]).join("");
}

export function createInvitationMetadata({ email, invitedBy = null, now = () => new Date().toISOString() } = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!isValidInviteEmail(normalizedEmail)) {
    throw new Error("بريد الدعوة غير صالح");
  }
  return {
    email: normalizedEmail,
    inviteStatus: "pending",
    invitedAt: now(),
    invitedBy,
    mustChangePassword: true
  };
}

export function createUserValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    username: String(partial.username || "").trim(),
    displayName: String(partial.displayName || "").trim(),
    passwordHash: partial.passwordHash || "",
    role: normalizeUserRole(partial.role),
    roleId: partial.roleId || partial.role_id,
    avatar: partial.avatar,
    email: partial.email,
    inviteStatus: partial.inviteStatus,
    invitedAt: partial.invitedAt,
    invitedBy: partial.invitedBy,
    customPermissions: partial.customPermissions,
    isActive: partial.isActive ?? true,
    lastLoginAt: partial.lastLoginAt,
    mustChangePassword: partial.mustChangePassword || false,
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

export function getFilteredUsers(users = [], query = "", role = "all") {
  const normalizedQuery = normalizeArabicSearchText(query);
  const normalizedRole = normalizeUserRole(role);
  const useRoleFilter = role !== "all";
  return [...users]
    .filter((user) => !useRoleFilter || user.role === normalizedRole)
    .filter((user) => {
      if (!normalizedQuery) return true;
      return [
        user.username,
        user.displayName,
        user.email,
        USER_ROLES.find((item) => item.id === user.role)?.label
      ].some((value) => normalizeArabicSearchText(value).includes(normalizedQuery));
    })
    .sort((a, b) => String(a.displayName || a.username || "").localeCompare(String(b.displayName || b.username || ""), "ar"));
}

export function getUserSummary(users = []) {
  const active = users.filter((user) => user.isActive).length;
  const inactive = users.length - active;
  const byRole = Object.fromEntries(USER_ROLES.map((role) => [role.id, users.filter((user) => user.role === role.id).length]));
  const activeAdmins = users.filter((user) => user.role === "admin" && user.isActive).length;
  return {
    total: users.length,
    active,
    inactive,
    activeAdmins,
    byRole
  };
}

export function canDeactivateUser(user, users = []) {
  if (!user?.isActive) return true;
  if (user.role !== "admin") return true;
  return users.filter((item) => item.role === "admin" && item.isActive && item.id !== user.id).length > 0;
}
