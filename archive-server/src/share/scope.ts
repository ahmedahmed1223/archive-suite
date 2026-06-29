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
export const SHARE_PERMISSION_TYPES = Object.freeze([
  "view",
  "comment",
  "download",
  "edit",
]);

type ScopeType = (typeof SHARE_SCOPE_TYPES)[number];
type PermissionType = (typeof SHARE_PERMISSION_TYPES)[number];

interface Capabilities {
  canView: boolean;
  canComment: boolean;
  canDownload: boolean;
  canEdit: boolean;
  [key: string]: boolean;
}

const CAPABILITY_MAP: Record<string, Readonly<Capabilities>> = Object.freeze({
  view: Object.freeze({
    canView: true,
    canComment: false,
    canDownload: false,
    canEdit: false,
  }),
  comment: Object.freeze({
    canView: true,
    canComment: true,
    canDownload: false,
    canEdit: false,
  }),
  download: Object.freeze({
    canView: true,
    canComment: true,
    canDownload: true,
    canEdit: false,
  }),
  edit: Object.freeze({
    canView: true,
    canComment: true,
    canDownload: true,
    canEdit: true,
  }),
});

function normalizeScopeType(type: unknown): ScopeType {
  if (type === "item" || type === "items") return "items";
  if (type === "collection") return "collection";
  if (type === "all") return "all";
  return "all";
}

function normalizePermission(permission: unknown): PermissionType {
  return (SHARE_PERMISSION_TYPES as readonly PermissionType[]).includes(
    permission as PermissionType
  )
    ? (permission as PermissionType)
    : "view";
}

export function permissionCapabilities(permission: unknown): Capabilities {
  const perm = normalizePermission(permission);
  const caps = CAPABILITY_MAP[perm as PermissionType] || CAPABILITY_MAP.view;
  return { ...caps };
}

interface ShareScope {
  type: ScopeType;
  ids: string[];
  label: string;
  permission: PermissionType;
}

/** Normalize arbitrary input into a safe scope: { type, ids[], label }. */
export function createShareScope(input?: unknown): ShareScope {
  const obj = (input ?? {}) as Record<string, unknown>;
  const type = normalizeScopeType(obj.type);
  const ids = Array.isArray(obj.ids)
    ? [
        ...new Set(
          obj.ids
            .map((id) => String(id || ""))
            .filter(Boolean)
        ),
      ]
    : [];
  const label = String(obj.label || "")
    .trim()
    .slice(0, 120);
  const permission = normalizePermission(obj.permission);
  return { type, ids, label, permission };
}

function isActive(item: unknown): boolean {
  const obj = item as { isDeleted?: unknown };
  return Boolean(item) && !obj.isDeleted;
}

interface VideoItem {
  id: string;
  isDeleted?: boolean;
  type?: string;
  subtype?: string;
  [key: string]: unknown;
}

interface VirtualCollection {
  id: string;
  itemIds?: string[];
}

interface Snapshot {
  videoItems?: VideoItem[];
  virtualCollections?: VirtualCollection[];
  contentTypes?: unknown[];
  vocabulary?: unknown[];
  hierarchicalTags?: unknown[];
}

/**
 * Resolve the concrete set of item ids a scope exposes.
 * @returns {Set<string>}
 */
export function resolveScopedItemIds(
  scope: ShareScope | unknown,
  {
    videoItems = [],
    virtualCollections = [],
  }: {
    videoItems?: VideoItem[];
    virtualCollections?: VirtualCollection[];
  } = {}
): Set<string> {
  const scopeObj = scope as ShareScope & { type?: string; ids?: string[] };
  const active = (videoItems as VideoItem[]).filter(isActive);
  if (scopeObj.type === "items") {
    const wanted = new Set(scopeObj.ids || []);
    return new Set(
      active.filter((it) => wanted.has(it.id)).map((it) => it.id)
    );
  }
  if (scopeObj.type === "collection") {
    const wantedCollections = new Set(scopeObj.ids || []);
    const itemIds = new Set<string>();
    for (const col of virtualCollections) {
      if (!wantedCollections.has(col.id)) continue;
      for (const id of Array.isArray(col.itemIds) ? col.itemIds : [])
        itemIds.add(String(id));
    }
    return new Set(
      active.filter((it) => itemIds.has(it.id)).map((it) => it.id)
    );
  }
  // "all"
  return new Set(active.map((it) => it.id));
}

interface FilteredSnapshot {
  version: string;
  sharedAt: string;
  share: {
    title: string;
    expiresAt: string;
    scopeLabel: string;
    permission: PermissionType;
    capabilities: Capabilities;
    passwordProtected: boolean;
    readOnly: boolean;
  };
  scope: ShareScope;
  counts: { items: number };
  videoItems: unknown[];
  contentTypes: unknown[];
  vocabulary: unknown[];
  hierarchicalTags: unknown[];
}

/**
 * Produce the public, read-only payload for a share token.
 * @param {object} snapshot - full StorageProvider snapshot
 * @param {object} scope - normalized scope
 */
export function filterSnapshotForShare(
  snapshot?: Snapshot,
  scope?: ShareScope,
  shareMeta?: Record<string, unknown>
): FilteredSnapshot {
  const snapshotObj = snapshot ?? {};
  const scopeObj = scope ?? { type: "all" as const, ids: [], label: "", permission: "view" as PermissionType };
  const metaObj = shareMeta ?? {};

  const videoItems = Array.isArray(snapshotObj.videoItems)
    ? snapshotObj.videoItems
    : [];
  const virtualCollections = Array.isArray(snapshotObj.virtualCollections)
    ? snapshotObj.virtualCollections
    : [];
  const ids = resolveScopedItemIds(scopeObj, { videoItems, virtualCollections });
  const items = videoItems
    .filter((it: VideoItem) => isActive(it) && ids.has(it.id))
    .map((it) => filterItemByFieldAcl(it, "public"));

  // Only the content types actually referenced keep the payload tight.
  const usedTypeIds = new Set(
    items.flatMap((it: any) =>
      [it.type, it.subtype].filter(Boolean)
    )
  );
  const contentTypes = (Array.isArray(snapshotObj.contentTypes)
    ? snapshotObj.contentTypes
    : []
  ).filter(
    (t: any) => usedTypeIds.size === 0 || usedTypeIds.has(t?.id)
  );

  return {
    version: "share-1.0",
    sharedAt: new Date().toISOString(),
    share: {
      title: String(metaObj.title || "")
        .trim()
        .slice(0, 120),
      expiresAt: (metaObj.expiresAt as string) || "",
      scopeLabel: scopeObj.label || "",
      permission: scopeObj.permission || "view",
      capabilities: permissionCapabilities(scopeObj.permission),
      passwordProtected: Boolean(metaObj.passwordProtected),
      readOnly: true,
    },
    scope: {
      type: scopeObj.type,
      label: scopeObj.label || "",
      permission: scopeObj.permission || "view",
      ids: scopeObj.ids,
    } as ShareScope,
    counts: { items: items.length },
    videoItems: items,
    contentTypes,
    vocabulary: Array.isArray(snapshotObj.vocabulary)
      ? snapshotObj.vocabulary
      : [],
    hierarchicalTags: Array.isArray(snapshotObj.hierarchicalTags)
      ? snapshotObj.hierarchicalTags
      : [],
    // Deliberately omitted: users, auditLogs, changeHistory, bookmarks,
    // relations, projects, settings.
  };
}
