const VIDEO_STORE = "video_items";

function emptyPlan() {
  return { newItems: [], updates: [], conflicts: [], deletes: [] };
}

export function createCloudSyncProvider({ storageProvider } = {}) {
  if (!storageProvider) {
    throw new Error("cloud sync provider requires a StorageProvider.");
  }

  return {
    stampMetadata: (entity) => entity,
    planIncoming: emptyPlan,
    mergeIntoLocal: ({ localItems = [] } = {}) => localItems,
    detectConflicts: emptyPlan,
    buildFieldDiff: () => [],
    summarizeConflictPlan: () => ({ newCount: 0, updateCount: 0, conflictCount: 0, deleteCount: 0, totalChanges: 0, needsReview: false }),
    filterDelta: (items = [], cursor = 0) => items.filter((item) => Number(item?.syncVersion) > Number(cursor || 0)),
    buildSyncFloor: (items = []) => Object.fromEntries((items || []).filter((item) => item?.id).map((item) => [item.id, Number(item.syncVersion) || 0])),
    subscribe() {
      return () => {};
    },
    async pushChange(change = {}) {
      const store = typeof change.store === "string" && change.store ? change.store : VIDEO_STORE;
      const record = change.record || change.item || null;
      if (!record || typeof record !== "object" || !record.id) {
        const error = new Error("Sync push requires a record with an id.");
        error.statusCode = 400;
        throw error;
      }
      const saved = await storageProvider.put(store, record);
      return { pushed: true, cursor: Number(saved?.syncVersion ?? record.syncVersion) || 0 };
    },
    async pullSince(cursor = 0) {
      const floor = Number(cursor) || 0;
      const all = await storageProvider.getAll(VIDEO_STORE);
      const items = (Array.isArray(all) ? all : []).filter((item) => Number(item?.syncVersion) > floor);
      const nextCursor = items.reduce((max, item) => Math.max(max, Number(item.syncVersion) || 0), floor);
      return { items, cursor: nextCursor };
    }
  };
}
