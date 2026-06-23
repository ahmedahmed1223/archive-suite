/**
 * Virtual list for performance — active when the current viewport needs it.
 * Only renders items near the viewport. Uses scroll/resize listeners.
 *
 * Supports both window-level scrolling (legacy) and container-level scrolling.
 * When a scrollKey is provided the scroll position is persisted to sessionStorage
 * so back-navigation restores the previous scroll offset.
 */
import { useState, useRef, useEffect, useCallback } from "react";

const MOBILE_MIN_ITEMS_TO_VIRTUALIZE = 20;
const DESKTOP_MIN_ITEMS_TO_VIRTUALIZE = 50;
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";
const DEFAULT_OVERSCAN = 5;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
  }
  return window.innerWidth <= 767;
}

/**
 * @param {object} options
 * @param {Array}   options.items          - The full list of items to virtualize.
 * @param {number}  [options.itemHeight]   - Fixed row height in px (legacy param, kept for compat).
 * @param {number}  [options.estimateSize] - Alias for itemHeight; takes precedence when provided.
 * @param {number}  [options.overscan]     - Extra items above/below viewport (default 5).
 * @param {string}  [options.scrollKey]    - sessionStorage key for scroll-position persistence.
 * @param {boolean} [options.containerScroll] - When true, tracks container scroll instead of window scroll.
 *
 * @returns {{
 *   containerRef: React.RefObject,
 *   visibleItems: Array<{item: *, index: number, style: object}>,
 *   topSpacerHeight: number,
 *   bottomSpacerHeight: number,
 *   totalSize: number,
 *   shouldVirtualize: boolean,
 *   totalCount: number,
 *   visibleCount: number,
 * }}
 */
export function useVirtualList({
  items = [],
  itemHeight = 120,
  estimateSize,
  overscan = DEFAULT_OVERSCAN,
  scrollKey,
  containerScroll = false,
} = {}) {
  // estimateSize takes precedence over itemHeight for forward-compat
  const rowHeight = estimateSize ?? itemHeight;

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: items.length });
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const containerRef = useRef(null);
  // Track whether we have restored the saved scroll position yet
  const scrollRestoredRef = useRef(false);

  const minItemsToVirtualize = isMobile ? MOBILE_MIN_ITEMS_TO_VIRTUALIZE : DESKTOP_MIN_ITEMS_TO_VIRTUALIZE;
  const shouldVirtualize = items.length > minItemsToVirtualize;

  // Viewport-width tracking (mobile/desktop threshold switch)
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateViewport = () => setIsMobile(isMobileViewport());
    updateViewport();
    window.addEventListener("resize", updateViewport, { passive: true });

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  // Save scroll position to sessionStorage when scrolling
  const saveScrollPosition = useCallback((scrollTop) => {
    if (!scrollKey || typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(scrollKey, String(scrollTop));
    } catch {
      // sessionStorage can throw in private mode; silently ignore
    }
  }, [scrollKey]);

  // Restore saved scroll position after mount
  useEffect(() => {
    if (!scrollKey || !containerRef.current || scrollRestoredRef.current) return;
    if (typeof sessionStorage === "undefined") return;

    try {
      const saved = sessionStorage.getItem(scrollKey);
      if (saved !== null) {
        const offset = Number(saved);
        if (!Number.isNaN(offset) && offset > 0) {
          if (containerScroll && containerRef.current) {
            containerRef.current.scrollTop = offset;
          } else {
            window.scrollTo({ top: offset, behavior: "instant" });
          }
        }
      }
    } catch {
      // ignore
    }
    scrollRestoredRef.current = true;
  }, [scrollKey, containerScroll]);

  // Main virtualization effect — recalculates visible range on scroll/resize
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
        let scrollTop;
        let viewportH;

        if (containerScroll && container) {
          scrollTop = container.scrollTop;
          viewportH = container.clientHeight;

          const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
          const end = Math.min(
            items.length,
            Math.ceil((scrollTop + viewportH) / rowHeight) + overscan
          );
          setVisibleRange({ start, end });
          saveScrollPosition(scrollTop);
        } else {
          scrollTop = window.scrollY;
          viewportH = window.innerHeight;
          const containerTop = container.getBoundingClientRect().top + scrollTop;

          const start = Math.max(
            0,
            Math.floor((scrollTop - containerTop) / rowHeight) - overscan
          );
          const end = Math.min(
            items.length,
            Math.ceil((scrollTop - containerTop + viewportH) / rowHeight) + overscan
          );
          setVisibleRange({ start, end });
          saveScrollPosition(scrollTop);
        }

        ticking = false;
      });
    };

    update(); // Initial calculation

    const target = containerScroll ? container : window;
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length, rowHeight, overscan, shouldVirtualize, containerScroll, saveScrollPosition]);

  const totalSize = items.length * rowHeight;

  // Items to render (visible slice + overscan)
  const visibleItems = shouldVirtualize
    ? items.slice(visibleRange.start, visibleRange.end).map((item, idx) => ({
        item,
        index: visibleRange.start + idx,
        style: {}, // flow layout — no absolute positioning needed
      }))
    : items.map((item, index) => ({ item, index, style: {} }));

  // Top/bottom spacers maintain scroll height without rendering off-screen items
  const topSpacerHeight = shouldVirtualize ? visibleRange.start * rowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? (items.length - visibleRange.end) * rowHeight
    : 0;

  return {
    containerRef,
    visibleItems,
    topSpacerHeight,
    bottomSpacerHeight,
    totalSize,
    shouldVirtualize,
    totalCount: items.length,
    visibleCount: visibleItems.length,
  };
}
