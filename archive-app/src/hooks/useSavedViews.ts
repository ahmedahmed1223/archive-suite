import * as React from "react";

interface SavedViewConfig {
  columns?: unknown;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, unknown>;
}

interface SavedView extends Required<Omit<SavedViewConfig, "columns">> {
  id: string;
  name: string;
  columns: unknown;
  createdAt: string;
}

const STORAGE_KEY = "archive:savedViews";
const MAX_VIEWS = 20;

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function readFromStorage(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

function writeToStorage(views: SavedView[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

export function useSavedViews() {
  const [savedViews, setSavedViews] = React.useState<SavedView[]>(readFromStorage);

  const saveView = React.useCallback((name: string, config: SavedViewConfig = {}) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;

    setSavedViews((prev) => {
      const filtered = prev.filter((view) => view.name !== trimmed);
      const next = [
        {
          id: makeId(),
          name: trimmed,
          columns: config.columns ?? null,
          sortBy: config.sortBy ?? "updatedAt",
          sortDir: config.sortDir ?? "desc",
          filters: config.filters ?? {},
          createdAt: nowIso(),
        },
        ...filtered,
      ].slice(0, MAX_VIEWS);
      writeToStorage(next);
      return next;
    });
  }, []);

  const deleteView = React.useCallback((id: string) => {
    setSavedViews((prev) => {
      const next = prev.filter((view) => view.id !== id);
      writeToStorage(next);
      return next;
    });
  }, []);

  const applyView = React.useCallback((_view: SavedView) => {
    // Intentional no-op.
  }, []);

  return { savedViews, saveView, deleteView, applyView };
}
