const React = require("react") as any;

export const ARCHIVE_ITEMS_MIME = "text/x-archive-items";

export interface DndState {
  ids: string[];
  count: number;
}

export interface DndControllerValue {
  dragState: DndState | null;
  startDrag: (ids: string | string[], event: { dataTransfer: DataTransfer }) => void;
  clearDrag: () => void;
}

export function encodeDragItems(ids: string[]): string {
  return JSON.stringify(ids);
}

export function decodeDragItems(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const DndContext = React.createContext(null);

export function DndProvider({ children }: { children: unknown }) {
  const [dragState, setDragState] = React.useState(null);

  const startDrag = React.useCallback((ids: string | string[], event: { dataTransfer: DataTransfer }) => {
    const safeIds = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!safeIds.length) return;
    setDragState({ ids: safeIds, count: safeIds.length });
    try {
      event.dataTransfer.setData(ARCHIVE_ITEMS_MIME, encodeDragItems(safeIds));
      event.dataTransfer.effectAllowed = "move";
    } catch {
      /* jsdom / older browsers: dataTransfer may be unavailable */
    }
  }, []);

  const clearDrag = React.useCallback(() => setDragState(null), []);

  const value = React.useMemo(() => ({ dragState, startDrag, clearDrag }), [dragState, startDrag, clearDrag]);

  return React.createElement(DndContext.Provider, { value }, children);
}

export function useDndController(): DndControllerValue | null {
  return React.useContext(DndContext);
}

export function getDragItemIds(event: { dataTransfer?: { getData: (mime: string) => string } }): string[] {
  try {
    const raw = event.dataTransfer?.getData(ARCHIVE_ITEMS_MIME);
    return raw ? decodeDragItems(raw) : [];
  } catch {
    return [];
  }
}
