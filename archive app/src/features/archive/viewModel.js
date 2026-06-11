import { normalizeArabicSearchText } from "../../utils/formatting.js";
import { itemHasDescriptionGap } from "./completeness.js";
import { WORKFLOW_STATES, getItemState } from "./itemStatus.js";

const ARCHIVE_SORT_FIELDS = new Set(["title", "createdAt", "updatedAt"]);
const ARCHIVE_VIEW_MODES = new Set(["grid", "tiles", "list", "table"]);
const ARCHIVE_ITEM_SIZES = new Set(["xs", "compact", "comfortable", "large", "xl"]);
const ARCHIVE_PAGE_SIZES = new Set([12, 24, 48, 96]);
const ARCHIVE_TOP_MODES = new Set(["quick", "detailed"]);
const ARCHIVE_STATUS_FILTERS = new Set(["all", ...WORKFLOW_STATES]);
const ARCHIVE_GRID_ROW_MIN = 1;
const ARCHIVE_GRID_ROW_MAX = 12;
export const ARCHIVE_GRID_COLUMN_MIN = 1;
export const ARCHIVE_GRID_COLUMN_MAX = 8;

export function normalizeArchiveViewMode(viewMode = "grid") {
  return ARCHIVE_VIEW_MODES.has(viewMode) ? viewMode : "grid";
}

export function normalizeArchiveItemSize(itemSize = "compact") {
  return ARCHIVE_ITEM_SIZES.has(itemSize) ? itemSize : "compact";
}

export function normalizeArchivePageSize(pageSize = 24) {
  const value = Number(pageSize);
  return ARCHIVE_PAGE_SIZES.has(value) ? value : 24;
}

export function normalizeArchivePage(page = 1) {
  const value = Number(page);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function normalizeArchiveTopMode(topMode = "quick") {
  return ARCHIVE_TOP_MODES.has(topMode) ? topMode : "quick";
}

export function normalizeArchiveGridRows(rows = 3) {
  const value = Number(rows);
  if (!Number.isFinite(value)) return 3;
  const normalized = Math.floor(value);
  return normalized >= ARCHIVE_GRID_ROW_MIN && normalized <= ARCHIVE_GRID_ROW_MAX ? normalized : 3;
}

export function normalizeArchiveGridColumns(columns) {
  if (columns === "auto" || columns == null) return "auto";
  const value = Number(columns);
  if (!Number.isFinite(value)) return "auto";
  const normalized = Math.floor(value);
  if (normalized < ARCHIVE_GRID_COLUMN_MIN) return ARCHIVE_GRID_COLUMN_MIN;
  if (normalized > ARCHIVE_GRID_COLUMN_MAX) return ARCHIVE_GRID_COLUMN_MAX;
  return normalized;
}

function flattenSearchValues(value, depth = 0) {
  if (value == null || depth > 2) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenSearchValues(item, depth + 1));
  if (typeof value === "object") return Object.values(value).flatMap((item) => flattenSearchValues(item, depth + 1));
  return [String(value)];
}

function getArchiveItemSearchValues(item = {}) {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  return [
    item.title,
    item.path,
    item.filePath,
    item.url,
    item.notes,
    ...(item.tags || []),
    ...flattenSearchValues(metadata)
  ];
}

export function getFilteredArchiveItems({
  videoItems = [],
  filterType = "all",
  filterSubtype = "all",
  filterStatus = "all",
  searchQuery = "",
  sortField = "updatedAt",
  sortDirection = "desc",
  showDeleted = false,
  showFavoritesOnly = false,
  showGapsOnly = false
} = {}) {
  const normalizedSortField = ARCHIVE_SORT_FIELDS.has(sortField) ? sortField : "updatedAt";
  const query = normalizeArabicSearchText(searchQuery.trim());

  const items = videoItems.filter((item) => {
    if (showDeleted ? !item.isDeleted : item.isDeleted) return false;
    if (filterType && filterType !== "all" && item.type !== filterType) return false;
    if (filterSubtype && filterSubtype !== "all" && item.subtype !== filterSubtype) return false;
    if (filterStatus && filterStatus !== "all" && getItemState(item) !== filterStatus) return false;
    if (showFavoritesOnly && !item.isFavorite) return false;
    if (showGapsOnly && !itemHasDescriptionGap(item)) return false;
    if (!query) return true;

    return getArchiveItemSearchValues(item).some((value) => normalizeArabicSearchText(value).includes(query));
  });

  return items.sort((a, b) => {
    let comparison = 0;
    if (normalizedSortField === "title") comparison = String(a.title || "").localeCompare(String(b.title || ""), "ar");
    if (normalizedSortField === "createdAt") comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    if (normalizedSortField === "updatedAt") comparison = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
    return sortDirection === "desc" ? -comparison : comparison;
  });
}

export function getArchiveActiveFilterCount({
  searchQuery = "",
  filterType = "all",
  filterSubtype = "all",
  filterStatus = "all",
  showFavoritesOnly = false,
  showDeleted = false
} = {}) {
  return [
    searchQuery.trim(),
    filterType && filterType !== "all",
    filterSubtype && filterSubtype !== "all",
    filterStatus && filterStatus !== "all",
    showFavoritesOnly,
    showDeleted
  ].filter(Boolean).length;
}

export function hasArchiveContentFilters(filters = {}) {
  return Boolean(
    filters.searchQuery?.trim()
    || filters.filterType && filters.filterType !== "all"
    || filters.filterSubtype && filters.filterSubtype !== "all"
    || filters.filterStatus && filters.filterStatus !== "all"
    || filters.showFavoritesOnly
  );
}

export function getArchiveResultRangeText({ total = 0, page = 1, itemsPerPage = 24 } = {}) {
  if (total === 0) return "لا توجد نتائج";
  const start = Math.min((page - 1) * itemsPerPage + 1, total);
  const end = Math.min(page * itemsPerPage, total);
  return `عرض ${start}-${end} من ${total}`;
}

export function createArchiveRouteParams({
  searchQuery = "",
  filterType = "all",
  filterSubtype = "all",
  filterStatus = "all",
  showDeleted = false,
  showFavoritesOnly = false,
  sortField = "updatedAt",
  sortDirection = "desc",
  viewMode = "grid",
  topMode = "quick",
  openImport = false,
  page = 1,
  pageSize = 24,
  itemSize = "compact",
  gridRows = 3,
  gridColumns = "auto"
} = {}) {
  const params = new URLSearchParams();
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  if (filterType && filterType !== "all") params.set("type", filterType);
  if (filterSubtype && filterSubtype !== "all") params.set("subtype", filterSubtype);
  if (filterStatus && filterStatus !== "all") params.set("status", filterStatus);
  if (showDeleted) params.set("deleted", "1");
  if (showFavoritesOnly) params.set("favorites", "1");
  if (sortField !== "updatedAt") params.set("sort", sortField);
  if (sortDirection !== "desc") params.set("dir", sortDirection);
  const normalizedViewMode = normalizeArchiveViewMode(viewMode);
  if (normalizedViewMode !== "grid") params.set("view", normalizedViewMode);
  const normalizedTopMode = normalizeArchiveTopMode(topMode);
  if (normalizedTopMode !== "quick") params.set("top", normalizedTopMode);
  const normalizedPage = normalizeArchivePage(page);
  if (normalizedPage > 1) params.set("page", String(normalizedPage));
  const normalizedPageSize = normalizeArchivePageSize(pageSize);
  if (normalizedPageSize !== 24) params.set("per", String(normalizedPageSize));
  const normalizedItemSize = normalizeArchiveItemSize(itemSize);
  if (normalizedItemSize !== "compact") params.set("size", normalizedItemSize);
  const normalizedGridRows = normalizeArchiveGridRows(gridRows);
  if (normalizedGridRows !== 3) params.set("rows", String(normalizedGridRows));
  const normalizedGridColumns = normalizeArchiveGridColumns(gridColumns);
  if (normalizedGridColumns !== "auto") params.set("cols", String(normalizedGridColumns));
  if (openImport) params.set("import", "1");
  return params;
}

export function parseArchiveRouteParams(params = new URLSearchParams()) {
  const sortField = params.get("sort") || "updatedAt";
  const filterStatus = params.get("status") || "all";
  return {
    searchQuery: params.get("q") || "",
    filterType: params.get("type") || "all",
    filterSubtype: params.get("subtype") || "all",
    filterStatus: ARCHIVE_STATUS_FILTERS.has(filterStatus) ? filterStatus : "all",
    showDeleted: params.get("deleted") === "1",
    showFavoritesOnly: params.get("favorites") === "1",
    sortField: ARCHIVE_SORT_FIELDS.has(sortField) ? sortField : "updatedAt",
    sortDirection: params.get("dir") === "asc" ? "asc" : "desc",
    viewMode: normalizeArchiveViewMode(params.get("view") || "grid"),
    topMode: normalizeArchiveTopMode(params.get("top") || "quick"),
    openImport: params.get("import") === "1",
    page: normalizeArchivePage(params.get("page") || 1),
    pageSize: normalizeArchivePageSize(params.get("per") || 24),
    itemSize: normalizeArchiveItemSize(params.get("size") || "compact"),
    gridRows: normalizeArchiveGridRows(params.get("rows") || 3),
    gridColumns: normalizeArchiveGridColumns(params.get("cols") || "auto")
  };
}
