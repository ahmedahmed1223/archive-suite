const EMPTY_ARRAY: any[] = [];

function shallowEqual(a: any, b: any) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

function memoizeSelector<TState, TResult>(fn: (state: TState) => TResult) {
  let lastResult: TResult | undefined;
  return (state: TState) => {
    const next = fn(state);
    if (shallowEqual(next, lastResult)) return lastResult as TResult;
    lastResult = next;
    return next;
  };
}

export const selectVideoItems = (state: Record<string, any>) => state.videoItems || EMPTY_ARRAY;
export const selectContentTypes = (state: Record<string, any>) => state.contentTypes || EMPTY_ARRAY;
export const selectSettings = (state: Record<string, any>) => state.settings || {};

export const selectActiveItems = (state: Record<string, any>) => selectVideoItems(state).filter((item: any) => !item.isDeleted);
export const selectDeletedItems = (state: Record<string, any>) => selectVideoItems(state).filter((item: any) => item.isDeleted);
export const selectFavoriteItems = (state: Record<string, any>) => selectActiveItems(state).filter((item: any) => item.isFavorite);

export const selectArchiveFilters = memoizeSelector((state: Record<string, any>) => ({
  query: state.searchQuery || "",
  type: state.filterType || "all",
  subtype: state.filterSubtype || "all",
  viewMode: state.viewMode || "grid",
  selectedItems: state.selectedItems || EMPTY_ARRAY
}));

export const selectSystemReadiness = memoizeSelector((state: Record<string, any>) => ({
  sqliteReady: !!state.sqliteReady,
  sqliteError: state.sqliteError || null,
  indexedDbReady: typeof indexedDB !== "undefined",
  lastCheckAt: state.settings?.systemHealth?.lastCheckAt || null,
  activeItems: selectActiveItems(state).length,
  contentTypes: selectContentTypes(state).length
}));

export const selectDataTransferSummary = memoizeSelector((state: Record<string, any>) => ({
  items: selectVideoItems(state).length,
  contentTypes: selectContentTypes(state).length,
  collections: state.virtualCollections?.length || 0,
  vocabulary: state.vocabulary?.length || 0,
  hierarchicalTags: state.hierarchicalTags?.length || 0,
  users: state.users?.length || 0,
  auditLogs: state.auditLogs?.length || 0
}));
