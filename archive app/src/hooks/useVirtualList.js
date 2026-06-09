/**
 * Virtual list for performance — active on all devices when list is long.
 * Only renders items near the viewport. Uses scroll/resize listeners.
 */
import { useState, useRef, useEffect } from "react";

const MIN_ITEMS_TO_VIRTUALIZE = 50;
const OVERSCAN = 5;              // extra items above/below viewport

export function useVirtualList({ items = [], itemHeight = 120 } = {}) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: items.length });
  const containerRef = useRef(null);

  const shouldVirtualize = items.length > MIN_ITEMS_TO_VIRTUALIZE;

  useEffect(() => {
    if (!shouldVirtualize || !containerRef.current) {
      setVisibleRange({ start: 0, end: items.length });
      return;
    }

    const container = containerRef.current;
    let ticking = false;

    const update = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const viewportH = window.innerHeight;
        const containerTop = container.getBoundingClientRect().top + scrollTop;

        const start = Math.max(
          0,
          Math.floor((scrollTop - containerTop) / itemHeight) - OVERSCAN
        );
        const end = Math.min(
          items.length,
          Math.ceil((scrollTop - containerTop + viewportH) / itemHeight) + OVERSCAN
        );

        setVisibleRange({ start, end });
        ticking = false;
      });
    };

    update(); // Initial calculation
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length, itemHeight, shouldVirtualize]);

  // Items to render (visible slice + overscan)
  const visibleItems = shouldVirtualize
    ? items.slice(visibleRange.start, visibleRange.end).map((item, idx) => ({
        item,
        index: visibleRange.start + idx,
        style: {}, // flow layout — no absolute positioning needed
      }))
    : items.map((item, index) => ({ item, index, style: {} }));

  // Top/bottom spacers maintain scroll height without rendering off-screen items
  const topSpacerHeight = shouldVirtualize ? visibleRange.start * itemHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? (items.length - visibleRange.end) * itemHeight
    : 0;

  return {
    containerRef,
    visibleItems,
    topSpacerHeight,
    bottomSpacerHeight,
    shouldVirtualize,
    totalCount: items.length,
    visibleCount: visibleItems.length,
  };
}
