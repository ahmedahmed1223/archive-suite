/**
 * Saved view persistence helpers for the Archive page.
 *
 * A view captures the current filter combination so it can be replayed in
 * one click. Stored under settings.ui.savedArchiveViews to ride along with
 * the existing settings persistence.
 */

const MAX_SAVED_VIEWS = 16;

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `view_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeSavedView(view) {
  if (!view || typeof view !== "object") return null;
  const name = String(view.name || "").trim();
  if (!name) return null;
  return {
    id: view.id || makeId(),
    name,
    createdAt: view.createdAt || nowIso(),
    filters: {
      query: view.filters?.query || "",
      type: view.filters?.type || "all",
      subtype: view.filters?.subtype || "all",
      favoritesOnly: !!view.filters?.favoritesOnly,
      showDeleted: !!view.filters?.showDeleted,
      missingFieldsOnly: !!view.filters?.missingFieldsOnly,
      dateFrom: view.filters?.dateFrom || "",
      dateTo: view.filters?.dateTo || "",
      sortField: view.filters?.sortField || "updatedAt",
      sortDirection: view.filters?.sortDirection || "desc",
      itemSize: view.filters?.itemSize || "compact",
      viewMode: view.filters?.viewMode || "grid"
    }
  };
}

export function getSavedViews(settings) {
  const raw = settings?.ui?.savedArchiveViews;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeSavedView).filter(Boolean);
}

export function addSavedView(settings, view) {
  const normalized = normalizeSavedView(view);
  if (!normalized) return getSavedViews(settings);
  const list = getSavedViews(settings).filter((entry) => entry.id !== normalized.id && entry.name !== normalized.name);
  return [normalized, ...list].slice(0, MAX_SAVED_VIEWS);
}

export function removeSavedView(settings, viewId) {
  return getSavedViews(settings).filter((entry) => entry.id !== viewId);
}

export function renameSavedView(settings, viewId, name) {
  const nextName = String(name || "").trim();
  if (!nextName) return getSavedViews(settings);
  return getSavedViews(settings).map((entry) => entry.id === viewId ? { ...entry, name: nextName } : entry);
}

export function captureCurrentFilters({ searchQuery, filterType, filterSubtype, showFavoritesOnly, showDeleted, missingFieldsOnly, dateFrom, dateTo, sortField, sortDirection, itemSize, viewMode }) {
  return {
    query: searchQuery || "",
    type: filterType || "all",
    subtype: filterSubtype || "all",
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

export function hasMeaningfulFilters(filters) {
  if (!filters) return false;
  if ((filters.query || "").trim()) return true;
  if (filters.type && filters.type !== "all") return true;
  if (filters.subtype && filters.subtype !== "all") return true;
  if (filters.favoritesOnly) return true;
  if (filters.showDeleted) return true;
  if (filters.missingFieldsOnly) return true;
  if (filters.dateFrom) return true;
  if (filters.dateTo) return true;
  if (filters.sortField && filters.sortField !== "updatedAt") return true;
  if (filters.sortDirection && filters.sortDirection !== "desc") return true;
  return false;
}
