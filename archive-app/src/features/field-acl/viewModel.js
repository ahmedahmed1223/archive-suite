export const FIELD_ACL_ROLES = ["admin", "editor", "viewer"];

const ROLE_SET = new Set(FIELD_ACL_ROLES);

export function normalizeFieldAcl(input = {}) {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(Object.entries(input).map(([key, roles]) => {
    const cleanKey = String(key || "").trim();
    const cleanRoles = Array.isArray(roles)
      ? [...new Set(roles.map((role) => String(role || "").trim()).filter((role) => ROLE_SET.has(role)))]
      : [];
    return cleanKey ? [cleanKey, cleanRoles] : null;
  }).filter(Boolean));
}

export function canViewField(fieldKey, fieldAcl = {}, userOrRole = {}) {
  const key = String(fieldKey || "").trim();
  const acl = normalizeFieldAcl(fieldAcl);
  const allowed = acl[key];
  if (!allowed || allowed.length === 0) return true;
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  if (role === "admin") return true;
  return allowed.includes(role);
}

export function filterItemByFieldAcl(item = {}, userOrRole = {}) {
  const acl = normalizeFieldAcl(item.fieldAcl);
  const hidden = Object.keys(acl).filter((key) => !canViewField(key, acl, userOrRole));
  if (!hidden.length) return item;
  const next = { ...item, metadata: { ...(item.metadata || {}) } };
  for (const key of hidden) {
    if (Object.hasOwn(next.metadata, key)) delete next.metadata[key];
    else if (Object.hasOwn(next, key)) next[key] = Array.isArray(next[key]) ? [] : "";
  }
  return next;
}
