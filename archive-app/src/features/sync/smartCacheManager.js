import { createSyncPolicy } from "./selectiveSyncPolicy.js";

const accessMap = new Map();

export function recordAccess(itemId, now = Date.now()) {
  const id = String(itemId);
  const entry = accessMap.get(id) || { count: 0, lastAccess: 0 };
  accessMap.set(id, { count: entry.count + 1, lastAccess: now });
}

export function getAccessScore(itemId) {
  return accessMap.get(String(itemId))?.count ?? 0;
}

export function rankForEviction(items, policy, ctx = {}) {
  if (!Array.isArray(items)) return [];
  const safePolicy = createSyncPolicy(policy);
  const now = Number.isFinite(ctx.now) ? ctx.now : Date.now();

  return [...items].sort((a, b) => {
    const aExcluded = !_isIncluded(a, safePolicy, ctx, now);
    const bExcluded = !_isIncluded(b, safePolicy, ctx, now);
    if (aExcluded !== bExcluded) return aExcluded ? -1 : 1;

    const aScore = getAccessScore(a?.id);
    const bScore = getAccessScore(b?.id);
    if (aScore !== bScore) return aScore - bScore;

    const aTs = _getTimestamp(a);
    const bTs = _getTimestamp(b);
    return aTs - bTs;
  });
}

export function evictToFitQuota(items, policy, quota, ctx = {}) {
  if (!Array.isArray(items)) return { keep: [], evict: [] };
  const ranked = rankForEviction(items, policy, ctx);
  const evictCount = Math.max(0, ranked.length - quota);
  return {
    evict: ranked.slice(0, evictCount),
    keep: ranked.slice(evictCount),
  };
}

export function resetAccessMap() {
  accessMap.clear();
}

function _isIncluded(item, safePolicy, ctx, now) {
  if (!item || item.id == null) return false;
  if (safePolicy.mode === "all") return true;
  const { folders = [], collections = [] } = ctx;
  const folderIds = new Set(safePolicy.includedFolderIds);
  const collectionIds = new Set(safePolicy.includedCollectionIds);
  const included = new Set();
  for (const f of Array.isArray(folders) ? folders : []) {
    if (f && folderIds.has(String(f.id))) {
      for (const id of Array.isArray(f.itemIds) ? f.itemIds : []) included.add(String(id));
    }
  }
  for (const c of Array.isArray(collections) ? collections : []) {
    if (c && collectionIds.has(String(c.id))) {
      for (const id of Array.isArray(c.itemIds) ? c.itemIds : []) included.add(String(id));
    }
  }
  return included.has(String(item.id));
}

function _getTimestamp(item) {
  const raw = item?.updatedAt || item?.createdAt;
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}
