/**
 * Pure selective-sync policy model (§1345).
 *
 * Builds on the §1172 sync layer (syncQueueModel / syncStatusStore) by
 * deciding *which* items participate in sync and *whether* sync should
 * run right now given the connection. Kept free of side effects so it
 * can be unit-tested in isolation and reused by the settings UI and
 * (later) the live sync push/pull loop.
 *
 * Policy shape (persisted under settings.sync):
 *   {
 *     mode: "all" | "selective",
 *     includedFolderIds: string[],
 *     includedCollectionIds: string[],
 *     bandwidth: "unlimited" | "wifi-only" | "metered",
 *     cachePolicy: "full" | "metadata" | "recent",
 *     recentDays: number
 *   }
 *
 * Backward compatibility: an absent/empty policy normalizes to mode
 * "all", so existing installs keep syncing everything.
 */

export const SYNC_MODES = ["all", "selective"];
export const SYNC_BANDWIDTH = ["unlimited", "wifi-only", "metered"];
export const SYNC_CACHE_POLICIES = ["full", "metadata", "recent"];

export const DEFAULT_RECENT_DAYS = 30;
const MAX_RECENT_DAYS = 3650;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Connection types that count as "not WiFi" for the wifi-only gate.
const METERED_CONNECTION_TYPES = ["cellular", "metered", "2g", "3g", "4g", "5g", "wimax"];

function toIdArray(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const entry of value) {
    if (entry == null) continue;
    const id = String(entry);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function clampRecentDays(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_RECENT_DAYS;
  return Math.min(Math.floor(num), MAX_RECENT_DAYS);
}

/**
 * Normalize a partial policy into a complete, safe policy object.
 * Pure — never mutates input. Unknown enum values fall back to the
 * backward-compatible defaults.
 */
export function createSyncPolicy(partial = {}) {
  const source = partial && typeof partial === "object" ? partial : {};
  return {
    mode: SYNC_MODES.includes(source.mode) ? source.mode : "all",
    includedFolderIds: toIdArray(source.includedFolderIds),
    includedCollectionIds: toIdArray(source.includedCollectionIds),
    bandwidth: SYNC_BANDWIDTH.includes(source.bandwidth) ? source.bandwidth : "unlimited",
    cachePolicy: SYNC_CACHE_POLICIES.includes(source.cachePolicy) ? source.cachePolicy : "full",
    recentDays: clampRecentDays(source.recentDays)
  };
}

// Build the set of item ids reachable through the included folders and
// collections. A container "includes" an item when its itemIds array
// contains the item id.
function collectIncludedItemIds(policy, { folders = [], collections = [] } = {}) {
  const included = new Set();
  const folderIds = new Set(policy.includedFolderIds);
  const collectionIds = new Set(policy.includedCollectionIds);

  for (const folder of Array.isArray(folders) ? folders : []) {
    if (!folder || !folderIds.has(String(folder.id))) continue;
    for (const itemId of Array.isArray(folder.itemIds) ? folder.itemIds : []) {
      included.add(String(itemId));
    }
  }
  for (const collection of Array.isArray(collections) ? collections : []) {
    if (!collection || !collectionIds.has(String(collection.id))) continue;
    for (const itemId of Array.isArray(collection.itemIds) ? collection.itemIds : []) {
      included.add(String(itemId));
    }
  }
  return included;
}

function isWithinRecentDays(item, recentDays, now) {
  const raw = item?.updatedAt || item?.createdAt;
  if (!raw) return false;
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return false;
  return now - ts <= recentDays * MS_PER_DAY;
}

/**
 * Decide whether a single item is included by the policy. Pure.
 *
 * - mode "all": always true, except the "recent" cache policy still
 *   prunes items older than recentDays (smart caching applies in both
 *   modes).
 * - mode "selective": true only when the item is reachable through an
 *   included folder or collection — and, for the "recent" cache policy,
 *   also recent enough.
 */
export function isItemIncluded(item, policy, ctx = {}) {
  if (!item || item.id == null) return false;
  const safePolicy = createSyncPolicy(policy);
  const now = Number.isFinite(ctx.now) ? ctx.now : Date.now();

  const passesCache =
    safePolicy.cachePolicy !== "recent" ||
    isWithinRecentDays(item, safePolicy.recentDays, now);

  if (safePolicy.mode === "all") return passesCache;

  const includedIds = ctx.includedItemIds instanceof Set
    ? ctx.includedItemIds
    : collectIncludedItemIds(safePolicy, ctx);
  const inScope = includedIds.has(String(item.id));
  return inScope && passesCache;
}

/**
 * Filter a list of items down to those the policy would sync. Pure.
 * Pre-computes the included-id set once for efficiency.
 */
export function filterSyncableItems(items, policy, ctx = {}) {
  if (!Array.isArray(items)) return [];
  const safePolicy = createSyncPolicy(policy);
  const now = Number.isFinite(ctx.now) ? ctx.now : Date.now();
  const includedItemIds = safePolicy.mode === "selective"
    ? collectIncludedItemIds(safePolicy, ctx)
    : null;
  return items.filter((item) =>
    isItemIncluded(item, safePolicy, { ...ctx, now, includedItemIds: includedItemIds || undefined })
  );
}

function isMeteredConnection(connectionType) {
  if (typeof connectionType !== "string") return false;
  return METERED_CONNECTION_TYPES.includes(connectionType.toLowerCase());
}

/**
 * Decide whether sync should run right now given connectivity. Pure.
 *
 * - offline → never.
 * - bandwidth "unlimited" → run whenever online.
 * - bandwidth "wifi-only" → run only on a non-metered (WiFi/ethernet)
 *   connection; blocks on cellular/metered.
 * - bandwidth "metered" → run when online (the user opted into using
 *   metered data); the cache policy is expected to keep it light.
 */
export function shouldSyncNow(policy, { online = true, connectionType = "" } = {}) {
  if (!online) return false;
  const safePolicy = createSyncPolicy(policy);
  if (safePolicy.bandwidth === "wifi-only") {
    return !isMeteredConnection(connectionType);
  }
  return true;
}

const MODE_LABEL = { all: "مزامنة كل العناصر", selective: "مزامنة انتقائية" };
const BANDWIDTH_LABEL = {
  unlimited: "بلا حدود",
  "wifi-only": "WiFi فقط",
  metered: "بيانات الجوال مسموحة"
};
const CACHE_LABEL = {
  full: "تخزين كامل",
  metadata: "بيانات وصفية فقط",
  recent: "الأحدث فقط"
};

/**
 * Build an Arabic summary string plus counts for the settings UI. Pure.
 * `syncableCount` is computed only when `items` are supplied in ctx.
 */
export function summarizePolicy(policy, ctx = {}) {
  const safePolicy = createSyncPolicy(policy);
  const items = Array.isArray(ctx.items) ? ctx.items : null;
  const syncableCount = items ? filterSyncableItems(items, safePolicy, ctx).length : null;

  const parts = [MODE_LABEL[safePolicy.mode]];
  if (safePolicy.mode === "selective") {
    const folders = safePolicy.includedFolderIds.length;
    const collections = safePolicy.includedCollectionIds.length;
    parts.push(`${folders} مجلد و${collections} مجموعة`);
  }
  parts.push(BANDWIDTH_LABEL[safePolicy.bandwidth]);
  parts.push(CACHE_LABEL[safePolicy.cachePolicy]);
  if (safePolicy.cachePolicy === "recent") {
    parts.push(`آخر ${safePolicy.recentDays} يوم`);
  }

  return {
    text: parts.join(" · "),
    mode: safePolicy.mode,
    folderCount: safePolicy.includedFolderIds.length,
    collectionCount: safePolicy.includedCollectionIds.length,
    syncableCount
  };
}
