const EMPTY_ARRAY = [];

export const selectVideoItems = (state) => state.videoItems || EMPTY_ARRAY;
export const selectContentTypes = (state) => state.contentTypes || EMPTY_ARRAY;
export const selectSettings = (state) => state.settings || {};

export const selectActiveItems = (state) => selectVideoItems(state).filter((item) => !item.isDeleted);
export const selectDeletedItems = (state) => selectVideoItems(state).filter((item) => item.isDeleted);
export const selectFavoriteItems = (state) => selectActiveItems(state).filter((item) => item.isFavorite);

export const selectArchiveFilters = (state) => ({
  query: state.searchQuery || "",
  type: state.filterType || "all",
  subtype: state.filterSubtype || "all",
  viewMode: state.viewMode || "grid",
  selectedItems: state.selectedItems || EMPTY_ARRAY
});

export const selectSystemReadiness = (state) => ({
  sqliteReady: !!state.sqliteReady,
  sqliteError: state.sqliteError || null,
  indexedDbReady: typeof indexedDB !== "undefined",
  lastCheckAt: state.settings?.systemHealth?.lastCheckAt || null,
  activeItems: selectActiveItems(state).length,
  contentTypes: selectContentTypes(state).length
});

export const selectDataTransferSummary = (state) => ({
  items: selectVideoItems(state).length,
  contentTypes: selectContentTypes(state).length,
  collections: state.virtualCollections?.length || 0,
  vocabulary: state.vocabulary?.length || 0,
  hierarchicalTags: state.hierarchicalTags?.length || 0,
  users: state.users?.length || 0,
  auditLogs: state.auditLogs?.length || 0
});
