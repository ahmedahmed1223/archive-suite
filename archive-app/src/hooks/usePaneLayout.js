/**
 * usePaneLayout — React hook for split-view pane state.
 *
 * Wraps paneManager so components can read/mutate panes reactively.
 * Persists to localStorage on every change.
 *
 * Usage:
 *   const { panes, openPane, closePane, setPage, resize } = usePaneLayout("archive");
 */
import { useState, useCallback } from "react";
import {
  getStoredPanes,
  storePanes,
  addPane,
  removePane,
  setPanePageId,
  resizePane,
} from "../features/layout/paneManager.js";

export function usePaneLayout(initialPageId = "archive") {
  const [panes, setPanes] = useState(() => {
    const stored = getStoredPanes();
    if (stored.length > 0) return stored;
    return [{ id: "pane_primary", pageId: initialPageId, sizePct: 100 }];
  });

  const openPane = useCallback((pageId) => {
    setPanes((current) => {
      const next = addPane(current, pageId);
      if (!next) return current;
      storePanes(next);
      return next;
    });
  }, []);

  const closePane = useCallback((id) => {
    setPanes((current) => {
      const next = removePane(current, id);
      storePanes(next);
      return next;
    });
  }, []);

  const setPage = useCallback((id, pageId) => {
    setPanes((current) => {
      const next = setPanePageId(current, id, pageId);
      storePanes(next);
      return next;
    });
  }, []);

  const resize = useCallback((draggedId, deltaPct) => {
    setPanes((current) => {
      const next = resizePane(current, draggedId, deltaPct);
      storePanes(next);
      return next;
    });
  }, []);

  return { panes, openPane, closePane, setPage, resize };
}

export default usePaneLayout;
