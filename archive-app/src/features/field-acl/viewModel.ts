export const FIELD_ACL_ROLES = ["admin", "editor", "viewer"] as const;

const ROLE_SET = new Set(FIELD_ACL_ROLES);

type FieldAclInput = Record<string, unknown>;

export function normalizeFieldAcl(input: unknown = {}) {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(Object.entries(input as FieldAclInput).map(([key, roles]) => {
    const cleanKey = String(key || "").trim();
    const cleanRoles = Array.isArray(roles)
      ? [...new Set(roles.map((role) => String(role || "").trim()).filter((role) => ROLE_SET.has(role as typeof FIELD_ACL_ROLES[number])))]
      : [];
    return cleanKey ? [cleanKey, cleanRoles] : null;
  }).filter(Boolean) as Array<[string, string[]]>);
}

export function canViewField(fieldKey: unknown, fieldAcl: unknown = {}, userOrRole: unknown = {}) {
  const key = String(fieldKey || "").trim();
  const acl = normalizeFieldAcl(fieldAcl) as Record<string, string[]>;
  const allowed = acl[key];
  if (!allowed || allowed.length === 0) return true;
  const role = typeof userOrRole === "string" ? userOrRole : (userOrRole as any)?.role;
  if (role === "admin") return true;
  return allowed.includes(role);
}

export function filterItemByFieldAcl(item: any = {}, userOrRole: unknown = {}) {
  const acl = normalizeFieldAcl(item.fieldAcl) as Record<string, string[]>;
  const hidden = Object.keys(acl).filter((key) => !canViewField(key, acl, userOrRole));
  if (!hidden.length) return item;
  const next = { ...item, metadata: { ...(item.metadata || {}) } };
  for (const key of hidden) {
    if (Object.hasOwn(next.metadata, key)) delete next.metadata[key];
    else if (Object.hasOwn(next, key)) next[key] = Array.isArray(next[key]) ? [] : "";
  }
  return next;
}
