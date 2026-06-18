// Scoped sharing (G6) — pure scope model + snapshot filtering.
//
// A share scope says WHICH archive items a public link exposes. The public
// endpoint reads the full snapshot then runs it through filterSnapshotForShare,
// which returns a read-only, privacy-safe subset: only the in-scope, non-deleted
// video items plus the reference data needed to render them (content types,
// vocabulary, hierarchical tags). It NEVER includes users, audit logs, change
// history, bookmarks, relations, or settings.

import { filterItemByFieldAcl } from "./fieldAcl.js";

export const SHARE_SCOPE_TYPES = Object.freeze(["all", "items", "collection"]);
export const SHARE_PERMISSION_TYPES = Object.freeze(["view", "comment", "download", "edit"]);

const CAPABILITY_MAP = Object.freeze({
  view: Object.freeze({ canView: true, canComment: false, canDownload: false, canEdit: false }),
  comment: Object.freeze({ canView: true, canComment: true, canDownload: false, canEdit: false }),
  download: Object.freeze({ canView: true, canComment: true, canDownload: true, canEdit: false }),
  edit: Object.freeze({ canView: true, canComment: true, canDownload: true, canEdit: true })
});

function normalizeScopeType(type) {
  if (type === "item" || type === "items") return "items";
  if (type === "collection") return "collection";
  if (type === "all") return "all";
  return "all";
}

function normalizePermission(permission) {
  return SHARE_PERMISSION_TYPES.includes(permission) ? permission : "view";
}

export function permissionCapabilities(permission) {
  return { ...(CAPABILITY_MAP[normalizePermission(permission)] || CAPABILITY_MAP.view) };
}

/** Normalize arbitrary input into a safe scope: { type, ids[], label }. */
export function createShareScope(input = {}) {
  const type = normalizeScopeType(input?.type);
  const ids = Array.isArray(input?.ids)
    ? [...new Set(input.ids.map((id) => String(id || "")).filter(Boolean))]
    : [];
  const label = String(input?.label || "").trim().slice(0, 120);
  const permission = normalizePermission(input?.permission);
  return { type, ids, label, permission };
}

function isActive(item) {
  return Boolean(item) && !item.isDeleted;
}

/**
 * Resolve the concrete set of item ids a scope exposes.
 * @returns {Set<string>}
 */
export function resolveScopedItemIds(scope, { videoItems = [], virtualCollections = [] } = {}) {
  const active = videoItems.filter(isActive);
  if (scope?.type === "items") {
    const wanted = new Set(scope.ids || []);
    return new Set(active.filter((it) => wanted.has(it.id)).map((it) => it.id));
  }
  if (scope?.type === "collection") {
    const wantedCollections = new Set(scope.ids || []);
    const itemIds = new Set();
    for (const col of virtualCollections) {
      if (!wantedCollections.has(col.id)) continue;
      for (const id of Array.isArray(col.itemIds) ? col.itemIds : []) itemIds.add(String(id));
    }
    return new Set(active.filter((it) => itemIds.has(it.id)).map((it) => it.id));
  }
  // "all"
  return new Set(active.map((it) => it.id));
}

/**
 * Produce the public, read-only payload for a share token.
 * @param {object} snapshot - full StorageProvider snapshot
 * @param {object} scope - normalized scope
 */
export function filterSnapshotForShare(snapshot = {}, scope = { type: "all", ids: [] }, shareMeta = {}) {
  const videoItems = Array.isArray(snapshot.videoItems) ? snapshot.videoItems : [];
  const virtualCollections = Array.isArray(snapshot.virtualCollections) ? snapshot.virtualCollections : [];
  const ids = resolveScopedItemIds(scope, { videoItems, virtualCollections });
  const items = videoItems
    .filter((it) => isActive(it) && ids.has(it.id))
    .map((it) => filterItemByFieldAcl(it, "public"));

  // Only the content types actually referenced keep the payload tight.
  const usedTypeIds = new Set(items.flatMap((it) => [it.type, it.subtype].filter(Boolean)));
  const contentTypes = (Array.isArray(snapshot.contentTypes) ? snapshot.contentTypes : [])
    .filter((t) => usedTypeIds.size === 0 || usedTypeIds.has(t.id));

  return {
    version: "share-1.0",
    sharedAt: new Date().toISOString(),
    share: {
      title: String(shareMeta.title || "").trim().slice(0, 120),
      expiresAt: shareMeta.expiresAt || "",
      scopeLabel: scope.label || "",
      permission: scope.permission || "view",
      capabilities: permissionCapabilities(scope.permission),
      passwordProtected: Boolean(shareMeta.passwordProtected),
      readOnly: true
    },
    scope: { type: scope.type, label: scope.label || "", permission: scope.permission || "view" },
    counts: { items: items.length },
    videoItems: items,
    contentTypes,
    vocabulary: Array.isArray(snapshot.vocabulary) ? snapshot.vocabulary : [],
    hierarchicalTags: Array.isArray(snapshot.hierarchicalTags) ? snapshot.hierarchicalTags : []
    // Deliberately omitted: users, auditLogs, changeHistory, bookmarks,
    // relations, projects, settings.
  };
}
