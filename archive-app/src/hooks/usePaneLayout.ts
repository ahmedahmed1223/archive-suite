import { useState, useCallback } from "react";

import {
  getStoredPanes,
  storePanes,
  addPane,
  removePane,
  setPanePageId,
  resizePane,
} from "../features/layout/paneManager.js";

interface Pane {
  id: string;
  pageId: string;
  sizePct: number;
}

export function usePaneLayout(initialPageId = "archive") {
  const [panes, setPanes] = useState<Pane[]>(() => {
    const stored = getStoredPanes() as Pane[];
    if (stored.length > 0) return stored;
    return [{ id: "pane_primary", pageId: initialPageId, sizePct: 100 }];
  });

  const openPane = useCallback((pageId: string) => {
    setPanes((current) => {
      const next = addPane(current as Pane[], pageId) as Pane[] | null;
      if (!next) return current;
      storePanes(next);
      return next;
    });
  }, []);

  const closePane = useCallback((id: string) => {
    setPanes((current) => {
      const next = removePane(current as Pane[], id) as Pane[];
      storePanes(next);
      return next;
    });
  }, []);

  const setPage = useCallback((id: string, pageId: string) => {
    setPanes((current) => {
      const next = setPanePageId(current as Pane[], id, pageId) as Pane[];
      storePanes(next);
      return next;
    });
  }, []);

  const resize = useCallback((draggedId: string, deltaPct: number) => {
    setPanes((current) => {
      const next = resizePane(current as Pane[], draggedId, deltaPct) as Pane[];
      storePanes(next);
      return next;
    });
  }, []);

  return { panes, openPane, closePane, setPage, resize };
}

export default usePaneLayout;
