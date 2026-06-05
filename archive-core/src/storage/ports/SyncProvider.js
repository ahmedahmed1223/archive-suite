/**
 * SyncProvider port — abstracts the device-to-backend sync engine so the SPA
 * keeps its offline delta/conflict behavior while the cloud target layers the
 * SAME merge logic over PocketBase realtime.
 *
 * Pure engine methods (identical on every backend — they are deterministic
 * functions of their inputs):
 *  stampMetadata(entity, opts)            -> entity      add syncVersion/lastModifiedBy
 *  planIncoming({ localItems, incomingItems, baseSyncFloor }) -> plan
 *  mergeIntoLocal({ localItems, autoApply, resolved })        -> mergedItems
 *  detectConflicts({ localItems, incomingItems, baseSyncFloor }) -> plan
 *  buildFieldDiff({ local, incoming, base }) -> rows
 *  summarizeConflictPlan(plan)            -> summary
 *  filterDelta(items, peerFloor)          -> items
 *  buildSyncFloor(items)                  -> floor
 *
 * Transport methods (real for cloud, offline no-ops for the SPA):
 *  subscribe(handler)  -> unsubscribe()   live push (no-op offline)
 *  pushChange(change)  -> Promise<result> outbound write (queued/no-op offline)
 *  pullSince(cursor)   -> Promise<{ items, cursor }>  catch-up (empty offline)
 */
export const SYNC_PROVIDER_METHODS = [
  "stampMetadata",
  "planIncoming",
  "mergeIntoLocal",
  "detectConflicts",
  "buildFieldDiff",
  "summarizeConflictPlan",
  "filterDelta",
  "buildSyncFloor",
  "subscribe",
  "pushChange",
  "pullSince"
];

export function isSyncProvider(candidate) {
  return Boolean(candidate) && SYNC_PROVIDER_METHODS.every((method) => typeof candidate[method] === "function");
}
