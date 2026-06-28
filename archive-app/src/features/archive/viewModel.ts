import { normalizeArabicSearchText } from "../../utils/formatting.js";
import { itemHasDescriptionGap } from "./completeness.js";
import { WORKFLOW_STATES, getItemState } from "./itemStatus.js";
import { applyCustomOrder } from "./reorderItems.js";

const ARCHIVE_SORT_FIELDS = new Set(["title", "createdAt", "updatedAt"]);
const ARCHIVE_VIEW_MODES = new Set(["grid", "gallery", "compact", "list", "details"]);
const ARCHIVE_ITEM_SIZES = new Set(["xs", "compact", "comfortable", "large", "xl"]);
const ARCHIVE_PAGE_SIZES = new Set([12, 24, 48, 96]);
const ARCHIVE_TOP_MODES = new Set(["quick", "detailed"]);
const ARCHIVE_STATUS_FILTERS = new Set(["all", ...WORKFLOW_STATES]);
const ARCHIVE_GRID_ROW_MIN = 1;
const ARCHIVE_GRID_ROW_MAX = 12;
export const ARCHIVE_GRID_COLUMN_MIN = 1;
export const ARCHIVE_GRID_COLUMN_MAX = 8;

export type ArchiveViewMode = "grid" | "gallery" | "compact" | "list" | "details";
export type ArchiveItemSize = "xs" | "compact" | "comfortable" | "large" | "xl";
export type ArchiveTopMode = "quick" | "detailed";
export type ArchiveSortField = "title" | "createdAt" | "updatedAt";
export type ArchiveSortDirection = "asc" | "desc";
export type ArchiveGridColumns = "auto" | number;

export interface ArchiveItemLike {
  id?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  path?: string;
  filePath?: string;
  url?: string;
  notes?: string;
  tags?: unknown[];
  metadata?: Record<string, unknown> | null;
  type?: string;
  subtype?: string;
  workflowStatus?: unknown;
  isDeleted?: boolean;
  isFavorite?: boolean;
}

export interface ArchiveRouteParams {
  searchQuery?: string;
  filterType?: string;
  filterSubtype?: string;
  filterStatus?: string;
  showDeleted?: boolean;
  showFavoritesOnly?: boolean;
  sortField?: ArchiveSortField | string;
  sortDirection?: ArchiveSortDirection;
  viewMode?: ArchiveViewMode | string;
  topMode?: ArchiveTopMode | string;
  openImport?: boolean;
  page?: number | string;
  pageSize?: number | string;
  itemSize?: ArchiveItemSize | string;
  gridRows?: number | string;
  gridColumns?: ArchiveGridColumns | string;
}

function normalizeArchiveViewMode(viewMode = "grid"): ArchiveViewMode {
  if (viewMode === "masonry") return "gallery";
  if (viewMode === "tiles") return "compact";
  if (viewMode === "table") return "details";
  return ARCHIVE_VIEW_MODES.has(viewMode) ? viewMode as ArchiveViewMode : "grid";
}

export function getArchiveRenderViewMode(viewMode = "grid"): string {
  const normalized = normalizeArchiveViewMode(viewMode);
  if (normalized === "compact") return "tiles";
  if (normalized === "details") return "table";
  return normalized;
}

function normalizeArchiveItemSize(itemSize = "compact"): ArchiveItemSize {
  return ARCHIVE_ITEM_SIZES.has(itemSize as ArchiveItemSize) ? itemSize as ArchiveItemSize : "compact";
}

function normalizeArchivePageSize(pageSize: unknown = 24): number {
  const value = Number(pageSize);
  return ARCHIVE_PAGE_SIZES.has(value) ? value : 24;
}

function normalizeArchivePage(page: unknown = 1): number {
  const value = Number(page);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function normalizeArchiveTopMode(topMode = "quick"): ArchiveTopMode {
  return ARCHIVE_TOP_MODES.has(topMode as ArchiveTopMode) ? topMode as ArchiveTopMode : "quick";
}

function normalizeArchiveGridRows(rows: unknown = 3): number {
  const value = Number(rows);
  if (!Number.isFinite(value)) return 3;
  const normalized = Math.floor(value);
  return normalized >= ARCHIVE_GRID_ROW_MIN && normalized <= ARCHIVE_GRID_ROW_MAX ? normalized : 3;
}

function normalizeArchiveGridColumns(columns: unknown): ArchiveGridColumns {
  if (columns === "auto" || columns == null) return "auto";
  const value = Number(columns);
  if (!Number.isFinite(value)) return "auto";
  const normalized = Math.floor(value);
  if (normalized < ARCHIVE_GRID_COLUMN_MIN) return ARCHIVE_GRID_COLUMN_MIN;
  if (normalized > ARCHIVE_GRID_COLUMN_MAX) return ARCHIVE_GRID_COLUMN_MAX;
  return normalized;
}

function flattenSearchValues(value: unknown, depth = 0): string[] {
  if (value == null || depth > 2) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenSearchValues(item, depth + 1));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap((item) => flattenSearchValues(item, depth + 1));
  return [String(value)];
}

function getArchiveItemSearchValues(item: ArchiveItemLike = {}): string[] {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  return [
    item.title,
    item.path,
    item.filePath,
    item.url,
    item.notes,
    ...(item.tags || []).map((tag) => String(tag)),
    ...flattenSearchValues(metadata)
  ].filter((value): value is string => value != null).map((value) => String(value));
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
  showGapsOnly = false,
  customOrder = null
}: {
  videoItems?: ArchiveItemLike[];
  filterType?: string;
  filterSubtype?: string;
  filterStatus?: string;
  searchQuery?: string;
  sortField?: string;
  sortDirection?: ArchiveSortDirection;
  showDeleted?: boolean;
  showFavoritesOnly?: boolean;
  showGapsOnly?: boolean;
  customOrder?: ReadonlyArray<string> | null;
} = {}): ArchiveItemLike[] {
  const normalizedSortField = ARCHIVE_SORT_FIELDS.has(sortField as ArchiveSortField) ? sortField : "updatedAt";
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

  const sorted = items.sort((a, b) => {
    let comparison = 0;
    if (normalizedSortField === "title") comparison = String(a.title || "").localeCompare(String(b.title || ""), "ar");
    if (normalizedSortField === "createdAt") comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    if (normalizedSortField === "updatedAt") comparison = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
    return sortDirection === "desc" ? -comparison : comparison;
  });

  // §19.8 — a user-defined drag order, when present, overrides the field sort.
  return Array.isArray(customOrder) && customOrder.length ? applyCustomOrder(sorted, customOrder) as ArchiveItemLike[] : sorted;
}

export function getArchiveActiveFilterCount({
  searchQuery = "",
  filterType = "all",
  filterSubtype = "all",
  filterStatus = "all",
  showFavoritesOnly = false,
  showDeleted = false
}: {
  searchQuery?: string;
  filterType?: string;
  filterSubtype?: string;
  filterStatus?: string;
  showFavoritesOnly?: boolean;
  showDeleted?: boolean;
} = {}): number {
  return [
    searchQuery.trim(),
    filterType && filterType !== "all",
    filterSubtype && filterSubtype !== "all",
    filterStatus && filterStatus !== "all",
    showFavoritesOnly,
    showDeleted
  ].filter(Boolean).length;
}

export function hasArchiveContentFilters(filters: ArchiveRouteParams = {}): boolean {
  return Boolean(
    filters.searchQuery?.trim()
    || filters.filterType && filters.filterType !== "all"
    || filters.filterSubtype && filters.filterSubtype !== "all"
    || filters.filterStatus && filters.filterStatus !== "all"
    || filters.showFavoritesOnly
  );
}

export function getArchiveResultRangeText({ total = 0, page = 1, itemsPerPage = 24 }: { total?: number; page?: number; itemsPerPage?: number } = {}): string {
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
}: {
  searchQuery?: string;
  filterType?: string;
  filterSubtype?: string;
  filterStatus?: string;
  showDeleted?: boolean;
  showFavoritesOnly?: boolean;
  sortField?: string;
  sortDirection?: ArchiveSortDirection;
  viewMode?: string;
  topMode?: string;
  openImport?: boolean;
  page?: number | string;
  pageSize?: number | string;
  itemSize?: string;
  gridRows?: number | string;
  gridColumns?: number | string;
} = {}): URLSearchParams {
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

export function parseArchiveRouteParams(params: URLSearchParams = new URLSearchParams()): {
  searchQuery: string;
  filterType: string;
  filterSubtype: string;
  filterStatus: string;
  showDeleted: boolean;
  showFavoritesOnly: boolean;
  sortField: string;
  sortDirection: ArchiveSortDirection;
  viewMode: ArchiveViewMode;
  topMode: ArchiveTopMode;
  openImport: boolean;
  page: number;
  pageSize: number;
  itemSize: ArchiveItemSize;
  gridRows: number;
  gridColumns: ArchiveGridColumns;
} {
  const sortField = params.get("sort") || "updatedAt";
  const filterStatus = params.get("status") || "all";
  return {
    searchQuery: params.get("q") || "",
    filterType: params.get("type") || "all",
    filterSubtype: params.get("subtype") || "all",
    filterStatus: ARCHIVE_STATUS_FILTERS.has(filterStatus) ? filterStatus : "all",
    showDeleted: params.get("deleted") === "1",
    showFavoritesOnly: params.get("favorites") === "1",
    sortField: ARCHIVE_SORT_FIELDS.has(sortField as ArchiveSortField) ? sortField : "updatedAt",
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
