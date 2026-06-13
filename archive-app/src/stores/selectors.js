const EMPTY_ARRAY = [];

// ── Memoization helpers ───────────────────────────────────────────────────────
// Selectors that return new object literals on every call (e.g. selectArchiveFilters)
// break useSyncExternalStore equality checks — the subscriber always sees a "new"
// value and triggers a re-render even when nothing actually changed.
//
// memoizeSelector wraps such selectors: if the freshly-computed result is
// shallowly equal to the previous result the previous reference is returned,
// preserving referential stability and preventing spurious re-renders.

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

function memoizeSelector(fn) {
  let lastResult;
  return (state) => {
    const next = fn(state);
    if (shallowEqual(next, lastResult)) return lastResult;
    lastResult = next;
    return next;
  };
}

// ── Primitive / array selectors (no memoization needed) ──────────────────────
export const selectVideoItems = (state) => state.videoItems || EMPTY_ARRAY;
export const selectContentTypes = (state) => state.contentTypes || EMPTY_ARRAY;
export const selectSettings = (state) => state.settings || {};

export const selectActiveItems = (state) => selectVideoItems(state).filter((item) => !item.isDeleted);
export const selectDeletedItems = (state) => selectVideoItems(state).filter((item) => item.isDeleted);
export const selectFavoriteItems = (state) => selectActiveItems(state).filter((item) => item.isFavorite);

// Memoized: returns stable reference when values unchanged → no spurious re-renders
export const selectArchiveFilters = memoizeSelector((state) => ({
  query: state.searchQuery || "",
  type: state.filterType || "all",
  subtype: state.filterSubtype || "all",
  viewMode: state.viewMode || "grid",
  selectedItems: state.selectedItems || EMPTY_ARRAY
}));

export const selectSystemReadiness = memoizeSelector((state) => ({
  sqliteReady: !!state.sqliteReady,
  sqliteError: state.sqliteError || null,
  indexedDbReady: typeof indexedDB !== "undefined",
  lastCheckAt: state.settings?.systemHealth?.lastCheckAt || null,
  activeItems: selectActiveItems(state).length,
  contentTypes: selectContentTypes(state).length
}));

export const selectDataTransferSummary = memoizeSelector((state) => ({
  items: selectVideoItems(state).length,
  contentTypes: selectContentTypes(state).length,
  collections: state.virtualCollections?.length || 0,
  vocabulary: state.vocabulary?.length || 0,
  hierarchicalTags: state.hierarchicalTags?.length || 0,
  users: state.users?.length || 0,
  auditLogs: state.auditLogs?.length || 0
}));
