/**
 * Keyboard navigation for lists/grids.
 * Supports:
 *   - Arrow Up/Down: move focus between items
 *   - Enter/Space: select/activate focused item
 *   - Ctrl+A: select all items
 *   - Escape: clear selection
 *   - Home/End: jump to first/last item
 */
import { useState, useCallback, useRef } from "react";

export function useKeyboardListNav({ items = [], onSelect, onActivate, multiSelect = true } = {}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const containerRef = useRef(null);

  const moveFocus = useCallback((direction) => {
    setFocusedIndex((prev) => {
      const next =
        direction === "up"
          ? Math.max(0, prev - 1)
          : Math.min(items.length - 1, prev + 1);
      // Scroll item into view — supports both data-list-item and
      // data-archive-item-id (used by AnimatedItem in ArchiveViews).
      const container = containerRef.current;
      if (container) {
        const el =
          container.querySelectorAll("[data-list-item]")[next] ||
          container.querySelectorAll("[data-archive-item-id]")[next];
        el?.scrollIntoView({ block: "nearest" });
      }
      return next;
    });
  }, [items.length]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelect?.(id, next.has(id));
      return next;
    });
  }, [onSelect]);

  const selectAll = useCallback(() => {
    const all = new Set(items.map((item) => item.id));
    setSelectedIds(all);
    items.forEach((item) => onSelect?.(item.id, true));
  }, [items, onSelect]);

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => {
      prev.forEach((id) => onSelect?.(id, false));
      return new Set();
    });
    setFocusedIndex(-1);
  }, [onSelect]);

  // Keyboard handler to attach to the container
  const onKeyDown = useCallback((e) => {
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
          onActivate?.(items[focusedIndex], focusedIndex);
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
  }, [focusedIndex, items, moveFocus, toggleSelect, selectAll, clearSelection, onActivate, multiSelect]);

  return {
    containerRef,
    onKeyDown,
    focusedIndex,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected: (id) => selectedIds.has(id),
    isFocused: (idx) => idx === focusedIndex,
  };
}
