export const FIELD_ACL_ROLES = ["admin", "editor", "viewer"] as const;

type FieldAclRole = (typeof FIELD_ACL_ROLES)[number];

const ROLE_SET = new Set(FIELD_ACL_ROLES);

interface FieldAclInput {
  [key: string]: string[] | undefined;
}

export function normalizeFieldAcl(input?: unknown): Record<string, FieldAclRole[]> {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(obj)
      .map(([key, roles]) => {
        const cleanKey = String(key || "").trim();
        const cleanRoles = Array.isArray(roles)
          ? [
              ...new Set(
                roles
                  .map((role) => String(role || "").trim())
                  .filter((role) => ROLE_SET.has(role as FieldAclRole))
              ),
            ]
          : [];
        return cleanKey ? [cleanKey, cleanRoles] : null;
      })
      .filter((entry): entry is [string, FieldAclRole[]] => entry !== null)
  );
}

type UserOrRole = string | { role?: string };

export function canViewField(
  fieldKey: unknown,
  fieldAcl?: unknown,
  userOrRole?: UserOrRole
): boolean {
  const key = String(fieldKey || "").trim();
  const acl = normalizeFieldAcl(fieldAcl);
  const allowed = acl[key];
  if (!allowed || allowed.length === 0) return true;
  const role =
    typeof userOrRole === "string"
      ? userOrRole
      : (userOrRole as { role?: string } | undefined)?.role;
  if (role === "admin") return true;
  return allowed.includes(role as FieldAclRole);
}

interface Item {
  [key: string]: unknown;
  fieldAcl?: unknown;
  metadata?: Record<string, unknown>;
}

export function filterItemByFieldAcl(
  item?: unknown,
  userOrRole?: UserOrRole
): Item {
  const itemObj = (item ?? {}) as Item;
  const acl = normalizeFieldAcl(itemObj.fieldAcl);
  const hidden = Object.keys(acl).filter(
    (key) => !canViewField(key, acl, userOrRole)
  );
  if (!hidden.length) return itemObj;

  const next: Item = {
    ...itemObj,
    metadata: { ...(itemObj.metadata || {}) },
  };
  for (const key of hidden) {
    if (next.metadata && Object.hasOwn(next.metadata, key)) delete next.metadata[key];
    else if (Object.hasOwn(next, key))
      next[key] = Array.isArray(next[key]) ? [] : "";
  }
  return next;
}
