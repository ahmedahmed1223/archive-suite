import { useState, useCallback, useRef, useEffect } from "react";

interface KeyboardNavItem {
  id: string | number;
}

interface UseKeyboardListNavOptions {
  items?: KeyboardNavItem[];
  onSelect?: (id: string | number, selected: boolean) => void;
  onActivate?: (item: KeyboardNavItem, index: number) => void;
  multiSelect?: boolean;
}

export function useKeyboardListNav({
  items = [],
  onSelect,
  onActivate,
  multiSelect = true,
}: UseKeyboardListNavOptions = {}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const containerRef = useRef<HTMLElement | null>(null);

  const onSelectRef = useRef(onSelect);
  const onActivateRef = useRef(onActivate);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  const moveFocus = useCallback(
    (direction: "up" | "down") => {
      setFocusedIndex((prev) => {
        const next =
          direction === "up" ? Math.max(0, prev - 1) : Math.min(items.length - 1, prev + 1);
        const container = containerRef.current;
        if (container) {
          const listItems = container.querySelectorAll<HTMLElement>("[data-list-item]");
          const archiveItems = container.querySelectorAll<HTMLElement>("[data-archive-item-id]");
          const el = listItems[next] || archiveItems[next];
          el?.scrollIntoView({ block: "nearest" });
        }
        return next;
      });
    },
    [items.length]
  );

  const toggleSelect = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectRef.current?.(id, next.has(id));
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const all = new Set(items.map((item) => item.id));
    setSelectedIds(all);
    items.forEach((item) => onSelectRef.current?.(item.id, true));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => {
      prev.forEach((id) => onSelectRef.current?.(id, false));
      return new Set();
    });
    setFocusedIndex(-1);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveFocus("down");
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocus("up");
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(items.length - 1);
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < items.length) {
            onActivateRef.current?.(items[focusedIndex], focusedIndex);
          }
          break;
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < items.length && multiSelect) {
            toggleSelect(items[focusedIndex].id);
          }
          break;
        case "a":
        case "A":
          if ((e.ctrlKey || e.metaKey) && multiSelect) {
            e.preventDefault();
            selectAll();
          }
          break;
        case "Escape":
          e.preventDefault();
          clearSelection();
          break;
        default:
          break;
      }
    },
    [focusedIndex, items, moveFocus, toggleSelect, selectAll, clearSelection, multiSelect]
  );

  return {
    containerRef,
    onKeyDown,
    focusedIndex,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected: (id: string | number) => selectedIds.has(id),
    isFocused: (idx: number) => idx === focusedIndex,
  };
}
