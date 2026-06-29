const VIDEO_STORE = "video_items";

interface SyncPlan {
  newItems: unknown[];
  updates: unknown[];
  conflicts: unknown[];
  deletes: unknown[];
}

interface Change {
  store?: string;
  record?: Record<string, unknown>;
  item?: Record<string, unknown>;
}

interface PushResult {
  pushed: boolean;
  cursor: number;
}

interface PullResult {
  items: Record<string, unknown>[];
  cursor: number;
}

interface StorageProvider {
  put(store: string, record: Record<string, unknown>): Promise<Record<string, unknown>>;
  getAll(store: string): Promise<Record<string, unknown>[]>;
}

interface CloudSyncProviderOptions {
  storageProvider?: StorageProvider;
}

function emptyPlan(): SyncPlan {
  return { newItems: [], updates: [], conflicts: [], deletes: [] };
}

export function createCloudSyncProvider({ storageProvider }: CloudSyncProviderOptions = {}) {
  if (!storageProvider) {
    throw new Error("cloud sync provider requires a StorageProvider.");
  }

  return {
    stampMetadata: (entity: Record<string, unknown>) => entity,
    planIncoming: emptyPlan,
    mergeIntoLocal: ({ localItems = [] }: { localItems?: Record<string, unknown>[] } = {}) => localItems,
    detectConflicts: emptyPlan,
    buildFieldDiff: () => [],
    summarizeConflictPlan: () => ({ newCount: 0, updateCount: 0, conflictCount: 0, deleteCount: 0, totalChanges: 0, needsReview: false }),
    filterDelta: (items: Record<string, unknown>[] = [], cursor: number = 0) => items.filter((item) => Number(item?.syncVersion) > Number(cursor || 0)),
    buildSyncFloor: (items: Record<string, unknown>[] = []) => Object.fromEntries((items || []).filter((item) => item?.id).map((item) => [item.id, Number(item.syncVersion) || 0])),
    subscribe() {
      return () => {};
    },
    async pushChange(change: Change = {}) {
      const store = typeof change.store === "string" && change.store ? change.store : VIDEO_STORE;
      const record = change.record || change.item || null;
      if (!record || typeof record !== "object" || !(record as Record<string, unknown>).id) {
        const error = new Error("Sync push requires a record with an id.");
        (error as unknown as Record<string, unknown>).statusCode = 400;
        throw error;
      }
      const saved = await storageProvider.put(store, record as Record<string, unknown>);
      return { pushed: true, cursor: Number((saved as Record<string, unknown>)?.syncVersion ?? (record as Record<string, unknown>).syncVersion) || 0 };
    },
    async pullSince(cursor: number = 0): Promise<PullResult> {
      const floor = Number(cursor) || 0;
      const all = await storageProvider.getAll(VIDEO_STORE);
      const items = (Array.isArray(all) ? all : []).filter((item) => Number(item?.syncVersion) > floor);
      const nextCursor = items.reduce((max, item) => Math.max(max, Number(item.syncVersion) || 0), floor);
      return { items, cursor: nextCursor };
    }
  };
}
