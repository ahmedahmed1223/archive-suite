import * as React from "react";

import {
  parseAppRoute,
  writeAppRoute
} from "../../services/router/index.js";
import { useAppStore } from "../../stores/index.js";
import { appConfirm, showConfirm } from "../../components/common/ConfirmDialog.js";
import {
  createArchiveRouteParams,
  getArchiveActiveFilterCount,
  getArchiveResultRangeText,
  getFilteredArchiveItems,
  hasArchiveContentFilters,
  normalizeArchiveGridColumns,
  normalizeArchiveGridRows,
  normalizeArchiveItemSize,
  normalizeArchivePage,
  normalizeArchivePageSize,
  normalizeArchiveTopMode,
  normalizeArchiveViewMode,
  parseArchiveRouteParams
} from "./viewModel.js";
import {
  getVisibleColumns,
  normalizeArchiveTableColumns,
  setColumnWidth
} from "./tableColumns.js";
import {
  addSavedView,
  captureCurrentFilters,
  getSavedViews,
  hasMeaningfulFilters,
  removeSavedView
} from "./savedViews.js";
import { buildCustomOrderIds } from "./reorderItems.js";

// Grid-column responsive breakpoints — extracted so the page and the
// state hook share a single source of truth.
export function getGridColumnCount(width = 0, itemSize = "compact") {
  if (itemSize === "large") return width >= 1536 ? 3 : width >= 1024 ? 2 : 1;
  if (itemSize === "comfortable") return width >= 1536 ? 4 : width >= 1024 ? 3 : width >= 640 ? 2 : 1;
  return width >= 1536 ? 5 : width >= 1280 ? 4 : width >= 768 ? 3 : width >= 640 ? 2 : 1;
}

/**
 * Owns every piece of state, every effect, and every handler that the
 * Archive page composes. Splitting these out kept the page file under
 * 300 lines after the refactor without changing any user-visible
 * behavior. Callers receive a single object so destructuring stays
 * stable across renders.
 */
export function useArchivePageState() {
  const store = useAppStore();
  const {
    videoItems = [],
    contentTypes = [],
    virtualCollections = [],
    selectedItems: storeSelectedItems = [],
    currentUser = null,
    searchQuery = "",
    filterType = "all",
    filterSubtype = "all",
    settings = {},
    isLoading = false,
    viewMode: storeViewMode,
    setCurrentPage,
    setSelectedItemId,
    setNavItemIds,
    setSearchQuery,
    setFilterType,
    setFilterSubtype,
    setViewMode,
    updateSettings,
    updateVideoItem,
    toggleFavorite,
    deleteVideoItem,
    restoreVideoItem,
    addVideoItem,
    addRecentSearch,
    toggleBulkSelect,
    clearSelection,
    bulkDeleteItems,
    bulkRestoreItems,
    bulkAddTags,
    bulkMoveToCollection,
    bulkSetType,
    bulkSetProject,
    addItemsToCollection,
    emptyTrash,
    projects = [],
    undoLastActivity,
    addRelation,
    itemRelations = [],
    showToast,
    showNotification
  } = store;
  const viewMode = storeViewMode || settings.defaultView || "grid";

  const initialRouteParams = React.useMemo(() => parseAppRoute().params, []);
  const initialRouteState = React.useMemo(
    () => parseArchiveRouteParams(initialRouteParams),
    [initialRouteParams]
  );

  const [localSearch, setLocalSearch] = React.useState(initialRouteState.searchQuery || searchQuery || "");
  const [sortField, setSortField] = React.useState(initialRouteState.sortField || "updatedAt");
  const [sortDirection, setSortDirection] = React.useState(initialRouteState.sortDirection || "desc");
  const [filterStatus, setFilterStatus] = React.useState(initialRouteState.filterStatus || "all");
  const [showDeleted, setShowDeleted] = React.useState(initialRouteState.showDeleted || false);
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(initialRouteState.showFavoritesOnly || false);
  const [showGapsOnly, setShowGapsOnly] = React.useState(false);
  const [page, setPage] = React.useState(initialRouteState.page || 1);
  const [pageSize, setPageSize] = React.useState(initialRouteParams.has("per") ? initialRouteState.pageSize : settings.ui?.archivePageSize || 24);
  const [itemSize, setItemSize] = React.useState(initialRouteParams.has("size") ? initialRouteState.itemSize : settings.ui?.archiveItemSize || "compact");
  const [topMode, setTopMode] = React.useState(initialRouteParams.has("top") ? initialRouteState.topMode : settings.ui?.archiveTopMode || "quick");
  const [gridRows, setGridRows] = React.useState(initialRouteParams.has("rows") ? initialRouteState.gridRows : settings.ui?.archiveGridRows || 3);
  const [gridColumns, setGridColumnsState] = React.useState(initialRouteParams.has("cols") ? initialRouteState.gridColumns : settings.ui?.archiveGridColumns || "auto");
  const [gridColumnCount, setGridColumnCount] = React.useState(3);
  const [tableColumns, setTableColumns] = React.useState(() => normalizeArchiveTableColumns(settings.ui?.archiveTableColumns));
  const visibleTableColumns = React.useMemo(() => getVisibleColumns(tableColumns), [tableColumns]);
  const [contextMenu, setContextMenu] = React.useState(null);
  const [previewId, setPreviewId] = React.useState(null);
  const [showFileImportWizard, setShowFileImportWizard] = React.useState(initialRouteState.openImport || false);
  const [bulkMode, setBulkMode] = React.useState(false);
  const gridContainerRef = React.useRef(null);

  const activeViewMode = normalizeArchiveViewMode(viewMode || initialRouteState.viewMode || settings.defaultView || "grid");
  const listPageSize = normalizeArchivePageSize(pageSize);
  const activeItemSize = normalizeArchiveItemSize(itemSize);
  const activeTopMode = normalizeArchiveTopMode(topMode);
  const activeGridRows = normalizeArchiveGridRows(gridRows);
  const normalizedGridColumns = normalizeArchiveGridColumns(gridColumns);
  const resolvedGridColumnCount = normalizedGridColumns === "auto" ? gridColumnCount : normalizedGridColumns;
  const usesGridPaging = activeViewMode === "grid" || activeViewMode === "gallery" || activeViewMode === "compact";
  const activePageSize = usesGridPaging ? Math.max(1, activeGridRows * resolvedGridColumnCount) : listPageSize;

  const selectedIdSet = React.useMemo(() => new Set(storeSelectedItems || []), [storeSelectedItems]);
  const isItemSelected = React.useCallback((id) => selectedIdSet.has(id), [selectedIdSet]);
  const exitBulkMode = React.useCallback(() => {
    setBulkMode(false);
    clearSelection?.();
  }, [clearSelection]);

  React.useEffect(() => {
    if (!bulkMode) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") exitBulkMode();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bulkMode, exitBulkMode]);

  // Hydrate store-level filters from the URL on first mount.
  React.useEffect(() => {
    if (initialRouteState.searchQuery) setSearchQuery?.(initialRouteState.searchQuery);
    if (initialRouteState.filterType && initialRouteState.filterType !== filterType) setFilterType?.(initialRouteState.filterType);
    if (initialRouteState.filterSubtype && initialRouteState.filterSubtype !== filterSubtype) setFilterSubtype?.(initialRouteState.filterSubtype);
    if (initialRouteState.viewMode && initialRouteState.viewMode !== viewMode) setViewMode?.(initialRouteState.viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep transient state in sync with hash changes from elsewhere
  // (back button, deep-linked archive imports).
  React.useEffect(() => {
    const applyRouteFlags = () => {
      const nextRouteState = parseArchiveRouteParams(parseAppRoute().params);
      setShowFileImportWizard(Boolean(nextRouteState.openImport));
      if (nextRouteState.viewMode && nextRouteState.viewMode !== viewMode) setViewMode?.(nextRouteState.viewMode);
      if (nextRouteState.filterStatus !== filterStatus) setFilterStatus(nextRouteState.filterStatus);
      if (nextRouteState.page !== page) setPage(nextRouteState.page);
      if (nextRouteState.pageSize !== listPageSize) setPageSize(nextRouteState.pageSize);
      if (nextRouteState.itemSize !== activeItemSize) setItemSize(nextRouteState.itemSize);
      if (nextRouteState.topMode !== activeTopMode) setTopMode(nextRouteState.topMode);
      if (nextRouteState.gridRows !== activeGridRows) setGridRows(nextRouteState.gridRows);
      if (nextRouteState.gridColumns !== gridColumns) setGridColumnsState(nextRouteState.gridColumns);
    };
    const applyImportEvent = () => setShowFileImportWizard(true);
    window.addEventListener("hashchange", applyRouteFlags);
    window.addEventListener("popstate", applyRouteFlags);
    window.addEventListener("videoarchive:archive-import-open", applyImportEvent);
    return () => {
      window.removeEventListener("hashchange", applyRouteFlags);
      window.removeEventListener("popstate", applyRouteFlags);
      window.removeEventListener("videoarchive:archive-import-open", applyImportEvent);
    };
  }, [activeGridRows, activeItemSize, activeTopMode, filterStatus, gridColumns, listPageSize, page, setViewMode, viewMode]);

  // Debounce the live search so we don't push every keystroke into
  // recentSearches.
  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQuery?.(localSearch);
      if (localSearch.trim()) addRecentSearch?.(localSearch.trim());
    }, 120);
    return () => window.clearTimeout(handle);
  }, [addRecentSearch, localSearch, setSearchQuery]);

  // Resize observer for the grid container — drives gridColumnCount.
  React.useEffect(() => {
    const element = gridContainerRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      setGridColumnCount(getGridColumnCount(typeof window !== "undefined" ? window.innerWidth : 1200, activeItemSize));
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || element.clientWidth || 0;
      setGridColumnCount(getGridColumnCount(width, activeItemSize));
    });
    observer.observe(element);
    setGridColumnCount(getGridColumnCount(element.clientWidth || 0, activeItemSize));
    return () => observer.disconnect();
  }, [activeItemSize]);

  // Defer the search term so typing stays responsive on large archives: React
  // keeps the input update high-priority and recomputes the (potentially heavy)
  // filter against the deferred value in the background. At ~55ms/keystroke for
  // 2k items this removes perceived lag as the library grows, without the
  // complexity of DOM virtualization (pagination already caps the DOM at ≤96).
  const deferredSearch = React.useDeferredValue(localSearch);
  // §19.8 — persisted drag-reorder. The custom order only applies in the
  // default updatedAt-desc sort; any explicit sort the user picks wins.
  const archiveItemOrder = React.useMemo(
    () => (Array.isArray(settings.ui?.archiveItemOrder) ? settings.ui.archiveItemOrder : null),
    [settings.ui?.archiveItemOrder]
  );
  const customOrder = sortField === "updatedAt" && sortDirection === "desc" ? archiveItemOrder : null;
  const filteredItems = React.useMemo(() => getFilteredArchiveItems({
    videoItems,
    filterType,
    filterSubtype,
    filterStatus,
    searchQuery: deferredSearch,
    sortField,
    sortDirection,
    showDeleted,
    showFavoritesOnly,
    showGapsOnly,
    customOrder
  }), [filterStatus, filterType, filterSubtype, deferredSearch, showDeleted, showFavoritesOnly, showGapsOnly, sortDirection, sortField, videoItems, customOrder]);
  const quickSearchMatches = React.useMemo(
    () => (localSearch.trim() ? filteredItems.slice(0, 5) : []),
    [filteredItems, localSearch]
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / activePageSize));
  const currentPage = Math.min(normalizeArchivePage(page), totalPages);
  const visibleItems = filteredItems.slice((currentPage - 1) * activePageSize, currentPage * activePageSize);
  const rangeText = getArchiveResultRangeText({ total: filteredItems.length, page: currentPage, itemsPerPage: activePageSize });

  // Reset to page 1 after a filter change, but not when the URL already
  // hydrated us onto a deeper page or with explicit filters.
  const initialFilterHydrationSkips = React.useRef(
    initialRouteState.page > 1
    || initialRouteState.searchQuery
    || initialRouteState.filterType !== "all"
    || initialRouteState.filterSubtype !== "all"
    || initialRouteState.filterStatus !== "all"
    || initialRouteState.showDeleted
    || initialRouteState.showFavoritesOnly
    || initialRouteState.sortField !== "updatedAt"
    || initialRouteState.sortDirection !== "desc"
      ? 2
      : 1
  );
  const resetPageAfterFilterChange = React.useRef(0);

  React.useEffect(() => {
    resetPageAfterFilterChange.current += 1;
    if (resetPageAfterFilterChange.current <= initialFilterHydrationSkips.current) {
      return;
    }
    setPage(1);
  }, [activePageSize, filterStatus, filterType, filterSubtype, localSearch, showDeleted, showFavoritesOnly, sortDirection, sortField]);

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  // Write the URL on every interesting state change so back/forward
  // and reload restore the same view.
  React.useEffect(() => {
    const params = createArchiveRouteParams({
      searchQuery: localSearch,
      filterType,
      filterSubtype,
      filterStatus,
      showDeleted,
      showFavoritesOnly,
      sortField,
      sortDirection,
      viewMode: activeViewMode,
      topMode: activeTopMode,
      openImport: showFileImportWizard,
      page: currentPage,
      pageSize: listPageSize,
      itemSize: activeItemSize,
      gridRows: activeGridRows,
      gridColumns: normalizedGridColumns
    });
    writeAppRoute("archive", { params }, settings, true);
  }, [activeGridRows, activeItemSize, activeTopMode, activeViewMode, currentPage, filterStatus, filterType, filterSubtype, listPageSize, localSearch, normalizedGridColumns, settings, showDeleted, showFavoritesOnly, showFileImportWizard, sortDirection, sortField]);

  const typeById = React.useMemo(
    () => new Map(contentTypes.map((type) => [type.id, type])),
    [contentTypes]
  );
  const typeCounts = React.useMemo(() => new Map(contentTypes.map((type) => [
    type.id,
    videoItems.filter((item) => item.type === type.id && !item.isDeleted).length
  ])), [contentTypes, videoItems]);
  const activeType = typeById.get(filterType);
  const subtypes = activeType?.subtypes || [];
  const previewItem = filteredItems.find((item) => item.id === previewId) || visibleItems[0] || null;
  const activeFilterCount = getArchiveActiveFilterCount({ searchQuery: localSearch, filterType, filterSubtype, filterStatus, showDeleted, showFavoritesOnly });
  const hasFilters = hasArchiveContentFilters({ searchQuery: localSearch, filterType, filterSubtype, filterStatus, showFavoritesOnly });

  React.useEffect(() => {
    if (filterSubtype !== "all" && !subtypes.some((subtype) => subtype.id === filterSubtype)) {
      setFilterSubtype?.("all");
    }
  }, [filterSubtype, setFilterSubtype, subtypes]);

  const visibleIds = React.useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const toggleSelectAllVisible = React.useCallback(() => {
    if (allVisibleSelected) {
      clearSelection?.();
    } else {
      visibleIds.forEach((id) => {
        if (!selectedIdSet.has(id)) toggleBulkSelect?.(id);
      });
    }
  }, [allVisibleSelected, clearSelection, selectedIdSet, toggleBulkSelect, visibleIds]);

  const goToPage = React.useCallback((nextPage) => {
    const normalized = normalizeArchivePage(nextPage);
    setPage(Math.min(Math.max(normalized, 1), totalPages));
  }, [totalPages]);

  const updateArchiveUiPreference = React.useCallback((patch) => {
    updateSettings?.({ ui: { ...(settings.ui || {}), ...patch } });
  }, [settings.ui, updateSettings]);

  const changePageSize = React.useCallback((nextPageSize) => {
    const normalized = normalizeArchivePageSize(nextPageSize);
    setPageSize(normalized);
    setPage(1);
    updateArchiveUiPreference({ archivePageSize: normalized });
  }, [updateArchiveUiPreference]);

  const changeTopMode = React.useCallback((nextMode) => {
    const normalized = normalizeArchiveTopMode(nextMode);
    setTopMode(normalized);
    updateArchiveUiPreference({ archiveTopMode: normalized });
  }, [updateArchiveUiPreference]);

  const changeViewMode = React.useCallback((nextViewMode) => {
    const normalized = normalizeArchiveViewMode(nextViewMode);
    setViewMode?.(normalized);
    setPage(1);
    const patch = { archiveViewMode: normalized };
    if (activeItemSize === "xs") {
      if (normalized === "grid" || normalized === "gallery" || normalized === "compact") {
        setGridRows(12);
        setGridColumnsState(8);
        patch.archiveGridRows = 12;
        patch.archiveGridColumns = 8;
      } else {
        setPageSize(96);
        patch.archivePageSize = 96;
      }
    }
    updateArchiveUiPreference(patch);
  }, [activeItemSize, setViewMode, updateArchiveUiPreference]);

  const changeItemSize = React.useCallback((nextSize) => {
    const normalized = normalizeArchiveItemSize(nextSize);
    setItemSize(normalized);
    setPage(1);
    const patch = { archiveItemSize: normalized };
    if (normalized === "xs") {
      if (activeViewMode === "grid" || activeViewMode === "gallery" || activeViewMode === "compact") {
        setGridRows(12);
        setGridColumnsState(8);
        patch.archiveGridRows = 12;
        patch.archiveGridColumns = 8;
      } else {
        setPageSize(96);
        patch.archivePageSize = 96;
      }
    }
    updateArchiveUiPreference(patch);
  }, [activeViewMode, updateArchiveUiPreference]);

  const changeGridRows = React.useCallback((nextRows) => {
    const normalized = normalizeArchiveGridRows(nextRows);
    setGridRows(normalized);
    setPage(1);
    updateArchiveUiPreference({ archiveGridRows: normalized });
  }, [updateArchiveUiPreference]);

  const changeGridColumns = React.useCallback((nextColumns) => {
    const normalized = normalizeArchiveGridColumns(nextColumns);
    setGridColumnsState(normalized);
    setPage(1);
    updateArchiveUiPreference({ archiveGridColumns: normalized });
  }, [updateArchiveUiPreference]);

  const changeTableColumns = React.useCallback(async (next) => {
    const normalized = normalizeArchiveTableColumns(next);
    setTableColumns(normalized);
    await updateSettings?.({ ui: { ...(settings.ui || {}), archiveTableColumns: normalized } });
  }, [settings.ui, updateSettings]);

  // Debounce settings persistence during a column-resize drag so we
  // don't thrash IndexedDB on every pixel.
  const resizeFlushRef = React.useRef(null);
  const handleColumnResize = React.useCallback((columnId, width) => {
    setTableColumns((current) => {
      const next = setColumnWidth(current, columnId, width);
      if (resizeFlushRef.current) window.clearTimeout(resizeFlushRef.current);
      resizeFlushRef.current = window.setTimeout(() => {
        updateSettings?.({ ui: { ...(settings.ui || {}), archiveTableColumns: next } });
        resizeFlushRef.current = null;
      }, 280);
      return next;
    });
  }, [settings.ui, updateSettings]);

  React.useEffect(() => () => {
    if (resizeFlushRef.current) window.clearTimeout(resizeFlushRef.current);
  }, []);

  const resetFilters = React.useCallback(() => {
    setLocalSearch("");
    setFilterType?.("all");
    setFilterSubtype?.("all");
    setFilterStatus("all");
    setShowDeleted(false);
    setShowFavoritesOnly(false);
    setShowGapsOnly(false);
    setSortField("updatedAt");
    setSortDirection("desc");
    setPage(1);
  }, [setFilterSubtype, setFilterType]);

  const savedViews = React.useMemo(() => getSavedViews(settings), [settings]);
  const currentFiltersForSave = React.useMemo(() => captureCurrentFilters({
    searchQuery: localSearch,
    filterType,
    filterSubtype,
    filterStatus,
    showFavoritesOnly,
    showDeleted,
    sortField,
    sortDirection,
    itemSize: activeItemSize,
    viewMode: activeViewMode
  }), [activeItemSize, activeViewMode, filterStatus, filterSubtype, filterType, localSearch, showDeleted, showFavoritesOnly, sortDirection, sortField]);

  const applySavedView = React.useCallback((view) => {
    if (!view?.filters) return;
    const filters = view.filters;
    setLocalSearch(filters.query || "");
    setSearchQuery?.(filters.query || "");
    setFilterType?.(filters.type || "all");
    setFilterSubtype?.(filters.subtype || "all");
    setFilterStatus(filters.status || "all");
    setShowFavoritesOnly(!!filters.favoritesOnly);
    setShowDeleted(!!filters.showDeleted);
    setSortField(filters.sortField || "updatedAt");
    setSortDirection(filters.sortDirection || "desc");
    setPage(1);
    if (filters.itemSize && filters.itemSize !== activeItemSize) setItemSize(filters.itemSize);
    if (filters.viewMode && filters.viewMode !== activeViewMode) setViewMode?.(filters.viewMode);
    showToast?.(`تم تطبيق "${view.name}"`, "info");
  }, [activeItemSize, activeViewMode, setFilterSubtype, setFilterType, setSearchQuery, setViewMode, showToast]);

  const saveCurrentView = React.useCallback(async (name, filters) => {
    const nextList = addSavedView(settings, { name, filters });
    await updateSettings?.({ ui: { ...(settings.ui || {}), savedArchiveViews: nextList } });
    showToast?.(`تم حفظ العرض "${name}"`, "success");
  }, [settings, showToast, updateSettings]);

  const removeView = React.useCallback(async (viewId) => {
    const nextList = removeSavedView(settings, viewId);
    await updateSettings?.({ ui: { ...(settings.ui || {}), savedArchiveViews: nextList } });
  }, [settings, updateSettings]);

  const openAdd = React.useCallback(() => {
    setSelectedItemId?.(null);
    setCurrentPage?.("add");
  }, [setCurrentPage, setSelectedItemId]);

  const openItem = React.useCallback((item) => {
    // §1408: persist the current filtered order so the detail page can step
    // next/previous through the same list without returning to the archive.
    setNavItemIds?.(filteredItems.map((entry) => entry.id));
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  }, [setCurrentPage, setSelectedItemId, setNavItemIds, filteredItems]);

  // §19.8 — persist a custom drag order. We rebuild the order from the full
  // filtered list (not just the current page) so positions survive paging,
  // then snap the sort back to the default so the custom order is honored.
  const reorderArchiveItems = React.useCallback(async (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const orderIds = buildCustomOrderIds(filteredItems, fromId, toId);
    if (!orderIds.length) return;
    if (sortField !== "updatedAt" || sortDirection !== "desc") {
      setSortField("updatedAt");
      setSortDirection("desc");
    }
    try {
      await updateSettings?.({ ui: { archiveItemOrder: orderIds } });
    } catch (error) {
      showToast?.(error?.message || "تعذر حفظ الترتيب", "error");
    }
  }, [filteredItems, sortDirection, sortField, updateSettings, showToast]);

  const openImport = React.useCallback(() => {
    setShowFileImportWizard(true);
  }, []);

  const openProjects = React.useCallback(() => {
    setCurrentPage?.("projects");
  }, [setCurrentPage]);

  const confirmDelete = React.useCallback(async (item) => {
    const confirmed = await appConfirm(`حذف "${item.title || "العنصر"}" إلى سلة المحذوفات؟`, {
      title: "حذف فيديو",
      kind: "warning",
      confirmLabel: "حذف"
    });
    if (!confirmed) return;
    await deleteVideoItem?.(item.id);
    showToast?.("تم نقل العنصر إلى سلة المحذوفات", "info");
  }, [deleteVideoItem, showToast]);

  const confirmEmptyTrash = React.useCallback(async (deletedCount) => {
    const confirmed = await showConfirm({
      level: 3,
      title: "إفراغ سلة المحذوفات",
      message: `سيتم حذف ${deletedCount} عنصر بشكل نهائي وغير قابل للتراجع.\nلن يمكن استعادة هذه العناصر بعد التأكيد.`
    });
    if (!confirmed) return;
    try {
      await emptyTrash?.();
      showToast?.("تم إفراغ سلة المحذوفات نهائياً", "success");
    } catch (error) {
      showToast?.(error?.message || "تعذر إفراغ سلة المحذوفات", "error");
    }
  }, [emptyTrash, showToast]);

  const typeLabel = React.useCallback(
    (item) => typeById.get(item.type)?.name || item.type || "",
    [typeById]
  );
  const subtypeLabel = React.useCallback(
    (item) => typeById.get(item.type)?.subtypes?.find((subtype) => subtype.id === item.subtype)?.name || item.subtype || "",
    [typeById]
  );

  return {
    // store-derived
    videoItems,
    contentTypes,
    virtualCollections,
    projects,
    settings,
    isLoading,
    showToast,
    showNotification,
    currentUser,
    storeSelectedItems,
    addVideoItem,
    updateVideoItem,
    toggleFavorite,
    restoreVideoItem,
    toggleBulkSelect,
    clearSelection,
    bulkDeleteItems,
    bulkRestoreItems,
    bulkAddTags,
    bulkMoveToCollection,
    bulkSetType,
    bulkSetProject,
    addItemsToCollection,
    filterType,
    filterSubtype,
    setFilterType,
    setFilterSubtype,

    // local filter state
    localSearch,
    setLocalSearch,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    filterStatus,
    setFilterStatus,
    showDeleted,
    setShowDeleted,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showGapsOnly,
    setShowGapsOnly,
    resetFilters,
    hasFilters,
    activeFilterCount,

    // pagination
    page,
    setPage,
    currentPage,
    totalPages,
    listPageSize,
    activePageSize,
    rangeText,
    goToPage,
    changePageSize,

    // view & sizing
    activeViewMode,
    activeItemSize,
    activeTopMode,
    activeGridRows,
    gridColumns,
    gridColumnCount: resolvedGridColumnCount,
    gridContainerRef,
    changeViewMode,
    changeItemSize,
    changeTopMode,
    changeGridRows,
    changeGridColumns,
    tableColumns,
    visibleTableColumns,
    changeTableColumns,
    handleColumnResize,

    // derived data
    filteredItems,
    quickSearchMatches,
    visibleItems,
    visibleIds,
    typeById,
    typeCounts,
    subtypes,
    previewItem,
    previewId,
    setPreviewId,
    typeLabel,
    subtypeLabel,

    // selection & bulk
    selectedIdSet,
    isItemSelected,
    allVisibleSelected,
    toggleSelectAllVisible,
    bulkMode,
    setBulkMode,
    exitBulkMode,

    // file import wizard
    showFileImportWizard,
    setShowFileImportWizard,

    // context menu
    contextMenu,
    setContextMenu,

    // saved views
    savedViews,
    currentFiltersForSave,
    applySavedView,
    saveCurrentView,
    removeView,
    canSaveCurrentView: hasMeaningfulFilters(currentFiltersForSave),

    // actions
    openAdd,
    openItem,
    reorderArchiveItems,
    openImport,
    openProjects,
    confirmDelete,
    confirmEmptyTrash,
    undoLastActivity,
    addRelation,
    itemRelations
  };
}
