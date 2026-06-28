/**
 * Saved view persistence helpers for the Archive page.
 *
 * A view captures the current filter combination so it can be replayed in
 * one click. Stored under settings.ui.savedArchiveViews to ride along with
 * the existing settings persistence.
 */

export interface SavedViewFilters {
  query?: string;
  type?: string;
  subtype?: string;
  status?: string;
  favoritesOnly?: boolean;
  showDeleted?: boolean;
  missingFieldsOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortDirection?: string;
  itemSize?: string;
  viewMode?: string;
}

export interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  filters: Required<SavedViewFilters>;
}

const MAX_SAVED_VIEWS = 16;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `view_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeSavedView(view: unknown): SavedView | null {
  if (!view || typeof view !== "object") return null;
  const record = view as Partial<SavedView> & { filters?: SavedViewFilters };
  const name = String(record.name || "").trim();
  if (!name) return null;
  return {
    id: record.id || makeId(),
    name,
    createdAt: record.createdAt || nowIso(),
    filters: {
      query: record.filters?.query || "",
      type: record.filters?.type || "all",
      subtype: record.filters?.subtype || "all",
      status: record.filters?.status || "all",
      favoritesOnly: !!record.filters?.favoritesOnly,
      showDeleted: !!record.filters?.showDeleted,
      missingFieldsOnly: !!record.filters?.missingFieldsOnly,
      dateFrom: record.filters?.dateFrom || "",
      dateTo: record.filters?.dateTo || "",
      sortField: record.filters?.sortField || "updatedAt",
      sortDirection: record.filters?.sortDirection || "desc",
      itemSize: record.filters?.itemSize || "compact",
      viewMode: record.filters?.viewMode || "grid"
    }
  };
}

export function getSavedViews(settings: { ui?: { savedArchiveViews?: unknown } } | null | undefined): SavedView[] {
  const raw = settings?.ui?.savedArchiveViews;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeSavedView).filter(Boolean) as SavedView[];
}

export function addSavedView(settings: { ui?: { savedArchiveViews?: unknown } } | null | undefined, view: unknown): SavedView[] {
  const normalized = normalizeSavedView(view);
  if (!normalized) return getSavedViews(settings);
  const list = getSavedViews(settings).filter((entry) => entry.id !== normalized.id && entry.name !== normalized.name);
  return [normalized, ...list].slice(0, MAX_SAVED_VIEWS);
}

export function removeSavedView(settings: { ui?: { savedArchiveViews?: unknown } } | null | undefined, viewId: string): SavedView[] {
  return getSavedViews(settings).filter((entry) => entry.id !== viewId);
}

export function renameSavedView(settings: { ui?: { savedArchiveViews?: unknown } } | null | undefined, viewId: string, name: string): SavedView[] {
  const nextName = String(name || "").trim();
  if (!nextName) return getSavedViews(settings);
  return getSavedViews(settings).map((entry) => entry.id === viewId ? { ...entry, name: nextName } : entry);
}

export function captureCurrentFilters({ searchQuery, filterType, filterSubtype, filterStatus, showFavoritesOnly, showDeleted, missingFieldsOnly, dateFrom, dateTo, sortField, sortDirection, itemSize, viewMode }: {
  searchQuery?: string;
  filterType?: string;
  filterSubtype?: string;
  filterStatus?: string;
  showFavoritesOnly?: boolean;
  showDeleted?: boolean;
  missingFieldsOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortDirection?: string;
  itemSize?: string;
  viewMode?: string;
}): Required<SavedViewFilters> {
  return {
    query: searchQuery || "",
    type: filterType || "all",
    subtype: filterSubtype || "all",
    status: filterStatus || "all",
    favoritesOnly: !!showFavoritesOnly,
    showDeleted: !!showDeleted,
    missingFieldsOnly: !!missingFieldsOnly,
    dateFrom: dateFrom || "",
    dateTo: dateTo || "",
    sortField: sortField || "updatedAt",
    sortDirection: sortDirection || "desc",
    itemSize: itemSize || "compact",
    viewMode: viewMode || "grid"
  };
}

export function hasMeaningfulFilters(filters: SavedViewFilters | null | undefined): boolean {
  if (!filters) return false;
  if ((filters.query || "").trim()) return true;
  if (filters.type && filters.type !== "all") return true;
  if (filters.subtype && filters.subtype !== "all") return true;
  if (filters.status && filters.status !== "all") return true;
  if (filters.favoritesOnly) return true;
  if (filters.showDeleted) return true;
  if (filters.missingFieldsOnly) return true;
  if (filters.dateFrom) return true;
  if (filters.dateTo) return true;
  if (filters.sortField && filters.sortField !== "updatedAt") return true;
  if (filters.sortDirection && filters.sortDirection !== "desc") return true;
  return false;
}
