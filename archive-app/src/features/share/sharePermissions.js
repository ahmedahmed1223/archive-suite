// §1697 — pure share-permission model (SPA side).
//
// Defines the ordered permission levels used when sharing items and
// collections, the capability map each level grants, grant normalization, and a
// human-readable Arabic summary. PURE: no network, no DOM. The minted share
// link carries the chosen permission inside its scope so the viewer/server can
// enforce capabilities later (server enforcement is deferred — see §1697).

/** Scope types a grant may target. */
export const SHARE_SCOPE_TYPES = Object.freeze(["items", "collection"]);

/**
 * Ordered permission levels (least → most capable) with Arabic labels.
 * Order matters: it drives the segmented control and any "at least" checks.
 */
export const SHARE_PERMISSIONS = Object.freeze([
  Object.freeze({ id: "view", label: "عرض فقط", description: "الاطّلاع على العناصر دون تحميل أو تعديل." }),
  Object.freeze({ id: "comment", label: "تعليق", description: "الاطّلاع وإضافة تعليقات." }),
  Object.freeze({ id: "download", label: "تحميل", description: "الاطّلاع والتعليق وتنزيل الملفات." }),
  Object.freeze({ id: "edit", label: "تعديل", description: "صلاحيات كاملة: عرض وتعليق وتحميل وتعديل." })
]);

/** Default permission for backward-compatible shares. */
export const DEFAULT_SHARE_PERMISSION = "view";

const MAX_EXPIRY_DAYS = 365;

const PERMISSION_IDS = SHARE_PERMISSIONS.map((p) => p.id);

// Capabilities are cumulative along the ordered levels.
const CAPABILITY_MAP = Object.freeze({
  view: Object.freeze({ canView: true, canComment: false, canDownload: false, canEdit: false }),
  comment: Object.freeze({ canView: true, canComment: true, canDownload: false, canEdit: false }),
  download: Object.freeze({ canView: true, canComment: true, canDownload: true, canEdit: false }),
  edit: Object.freeze({ canView: true, canComment: true, canDownload: true, canEdit: true })
});

/** Whether a permission id is one of the known levels. */
export function isValidPermission(permission) {
  return PERMISSION_IDS.includes(permission);
}

function normalizeScopeType(scopeType) {
  if (scopeType === "item" || scopeType === "items") return "items";
  if (scopeType === "collection") return "collection";
  return "";
}

/** Whether a scope type is one of item|items|collection. */
export function isValidScopeType(scopeType) {
  return SHARE_SCOPE_TYPES.includes(normalizeScopeType(scopeType));
}

/**
 * Capabilities granted by a permission level.
 * Unknown/empty input falls back to the safest level (view).
 * @returns {{ canView: boolean, canComment: boolean, canDownload: boolean, canEdit: boolean }}
 */
export function permissionCapabilities(permission) {
  return { ...(CAPABILITY_MAP[permission] || CAPABILITY_MAP[DEFAULT_SHARE_PERMISSION]) };
}

/** Look up the descriptor (id/label/description) for a permission level. */
export function getPermissionMeta(permission) {
  return SHARE_PERMISSIONS.find((p) => p.id === permission) || null;
}

function normalizeScopeIds(scopeIds) {
  const list = Array.isArray(scopeIds) ? scopeIds : scopeIds == null ? [] : [scopeIds];
  return list
    .map((id) => (typeof id === "string" ? id.trim() : String(id ?? "").trim()))
    .filter(Boolean);
}

function normalizeExpiry(expiresInDays) {
  const days = Number(expiresInDays);
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.min(Math.floor(days), MAX_EXPIRY_DAYS);
}

/**
 * Build a normalized, validated share grant.
 * @returns {{ scopeType: string, scopeIds: string[], permission: string,
 *   expiresInDays: number, label: string, capabilities: object }}
 * @throws {Error} when scopeType, scopeIds, or permission are invalid.
 */
export function createShareGrant({ scopeType, scopeIds, permission = DEFAULT_SHARE_PERMISSION, expiresInDays, label = "" } = {}) {
  const normalizedScopeType = normalizeScopeType(scopeType);
  if (!normalizedScopeType) {
    throw new Error(`نوع المشاركة غير صالح: ${scopeType ?? "غير محدد"}.`);
  }
  const ids = normalizeScopeIds(scopeIds);
  if (ids.length === 0) {
    throw new Error("المشاركة تتطلّب تحديد عنصر أو مجموعة واحدة على الأقل.");
  }
  const level = isValidPermission(permission) ? permission : DEFAULT_SHARE_PERMISSION;
  return {
    scopeType: normalizedScopeType,
    scopeIds: ids,
    permission: level,
    expiresInDays: normalizeExpiry(expiresInDays),
    label: String(label || "").trim(),
    capabilities: permissionCapabilities(level)
  };
}

const SCOPE_LABELS = Object.freeze({ items: "مشاركة عنصر", collection: "مشاركة مجموعة" });

/**
 * Arabic one-line summary of a grant, e.g.
 * "مشاركة مجموعة — تعليق — تنتهي خلال 30 يوماً".
 */
export function describeShareGrant(grant) {
  if (!grant || !isValidScopeType(grant.scopeType)) return "مشاركة غير صالحة";
  const scopePart = SCOPE_LABELS[grant.scopeType];
  const permPart = getPermissionMeta(grant.permission)?.label || "عرض فقط";
  const days = normalizeExpiry(grant.expiresInDays);
  const expiryPart = days > 0 ? `تنتهي خلال ${days} يوماً` : "بدون تاريخ انتهاء";
  return `${scopePart} — ${permPart} — ${expiryPart}`;
}
