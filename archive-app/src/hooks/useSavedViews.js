/**
 * useSavedViews — localStorage-backed saved views hook.
 *
 * Manages an array of view configs (column visibility, sort, filters) stored
 * under the key "archive:savedViews".
 *
 * Each view: { id, name, columns, sortBy, sortDir, filters, createdAt }
 */
import * as React from "react";

const STORAGE_KEY = "archive:savedViews";
const MAX_VIEWS = 20;

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function readFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(views) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

/**
 * @returns {{
 *   savedViews: Array<{id: string, name: string, columns: any, sortBy: string, sortDir: string, filters: object, createdAt: string}>,
 *   saveView: (name: string, config: {columns?: any, sortBy?: string, sortDir?: string, filters?: object}) => void,
 *   deleteView: (id: string) => void,
 *   applyView: (view: object) => void,
 * }}
 */
export function useSavedViews() {
  const [savedViews, setSavedViews] = React.useState(readFromStorage);

  const saveView = React.useCallback((name, config = {}) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;

    setSavedViews((prev) => {
      // Replace any existing view with the same name
      const filtered = prev.filter((v) => v.name !== trimmed);
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

  const deleteView = React.useCallback((id) => {
    setSavedViews((prev) => {
      const next = prev.filter((v) => v.id !== id);
      writeToStorage(next);
      return next;
    });
  }, []);

  // applyView is intentionally a no-op at the hook level — callers destructure
  // the view and apply its fields to their own state. Exposed here for
  // testability and as a stable identity callers can reference.
  const applyView = React.useCallback((_view) => {
    // Intentional no-op: callers use the view object directly.
    // This hook does not own the archive filter state.
  }, []);

  return { savedViews, saveView, deleteView, applyView };
}
